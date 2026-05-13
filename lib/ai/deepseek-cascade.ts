import { parseDeepSeekChatCompletion } from "./deepseek-schema.js";
import { loadDeepSeekClientConfigFromEnv } from "./deepseek-config.js";
import {
  DeepSeekCascadeExhaustedError,
  DeepSeekEmptyContentError,
  DeepSeekHttpError,
} from "./errors.js";
import type { RunDeepSeekCascadeParams, RunDeepSeekCascadeResult } from "./types.js";

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const t = setTimeout(resolve, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      reject(signal?.reason ?? new Error("Aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function computeBackoffMs(attemptIndex: number, baseMs: number, maxMs: number): number {
  const exp = Math.min(maxMs, baseMs * 2 ** attemptIndex);
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exp * 0.25)));
  return exp + jitter;
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (header === null || header.trim() === "") {
    return undefined;
  }
  const sec = Number.parseInt(header, 10);
  if (!Number.isFinite(sec) || sec < 0) {
    return undefined;
  }
  return sec * 1000;
}

function extractAssistantText(
  data: ReturnType<typeof parseDeepSeekChatCompletion>,
  model: string,
): string {
  const choices = data.choices;
  const first = choices !== undefined && choices.length > 0 ? choices[0] : undefined;
  const msg = first?.message;
  const content = msg?.content;
  const finish = first?.finish_reason ?? "UNKNOWN";
  if (typeof content === "string" && content.trim() !== "") {
    return content;
  }
  const usage = data.usage;
  const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  throw new DeepSeekEmptyContentError(
    `Respuesta de ${model} sin texto (finish=${String(finish)}, reasoning_tokens=${String(reasoningTokens)}, completion_tokens=${String(completionTokens)}). Probablemente reasoning agotó budget.`,
    model,
    String(finish),
  );
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function shouldAbortCascade(status: number): boolean {
  if (status === 401 || status === 402 || status === 403 || status === 404 || status === 400) {
    return true;
  }
  return false;
}

async function postOnce(params: {
  readonly url: string;
  readonly apiKey: string;
  readonly model: string;
  readonly messages: RunDeepSeekCascadeParams["messages"];
  readonly temperature: number;
  readonly maxTokens: number;
  readonly timeoutMs: number;
  readonly signal: AbortSignal | undefined;
}): Promise<{
  readonly status: number;
  readonly json: unknown | undefined;
  readonly rawTextSnippet: string | undefined;
  readonly retryAfterMs?: number;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error("DEEPSEEK_TIMEOUT"));
  }, params.timeoutMs);
  const outer = params.signal;
  const onParentAbort = (): void => {
    controller.abort(outer?.reason ?? new Error("Aborted"));
  };
  outer?.addEventListener("abort", onParentAbort, { once: true });
  const body = JSON.stringify({
    model: params.model,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    top_p: 0.95,
    stream: false,
  });
  try {
    const res = await fetch(params.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body,
      signal: controller.signal,
    });
    const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const parsedJson: unknown = await res.json();
      return { status: res.status, json: parsedJson, rawTextSnippet: undefined, retryAfterMs };
    }
    const t = await res.text();
    return {
      status: res.status,
      json: undefined,
      rawTextSnippet: t.slice(0, 500),
      retryAfterMs,
    };
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onParentAbort);
  }
}

/**
 * Invoca la API chat/completions de DeepSeek con lista de modelos en cascada,
 * reintentos con backoff exponencial + jitter en 429/5xx y errores de red.
 */
export async function runDeepSeekCascade(
  params: RunDeepSeekCascadeParams,
): Promise<RunDeepSeekCascadeResult> {
  const cfg = loadDeepSeekClientConfigFromEnv();
  const cascade =
    params.modelCascade !== undefined && params.modelCascade.length > 0
      ? [...params.modelCascade]
      : [...cfg.modelCascadeDefault];
  const temperature = params.temperature ?? 0.15;
  const maxTokens = params.maxTokens ?? 8192;
  const causes: string[] = [];
  let attempts = 0;

  for (const model of cascade) {
    for (let r = 0; r < cfg.maxRetriesPerModel; r += 1) {
      attempts += 1;
      try {
        const { status, json, rawTextSnippet, retryAfterMs } = await postOnce({
          url: cfg.chatCompletionsUrl,
          apiKey: cfg.apiKey,
          model,
          messages: params.messages,
          temperature,
          maxTokens,
          timeoutMs: cfg.requestTimeoutMs,
          signal: params.signal,
        });
        if (status >= 200 && status < 300) {
          if (json === undefined) {
            causes.push(`[${model}] 200 sin JSON (texto): ${rawTextSnippet ?? ""}`);
            break;
          }
          const parsed = parseDeepSeekChatCompletion(json);
          const text = extractAssistantText(parsed, model);
          return { text, modelUsed: model, attempts };
        }
        const snippet =
          rawTextSnippet !== undefined
            ? rawTextSnippet
            : json === undefined
              ? ""
              : JSON.stringify(json).slice(0, 400);
        if (shouldAbortCascade(status)) {
          throw new DeepSeekHttpError(`DeepSeek HTTP ${String(status)}: ${snippet}`, status, snippet);
        }
        if (isRetryableStatus(status)) {
          causes.push(`[${model}] HTTP ${String(status)} intento ${String(r + 1)}: ${snippet}`);
          if (r + 1 < cfg.maxRetriesPerModel) {
            const backoff =
              status === 429 && retryAfterMs !== undefined
                ? retryAfterMs
                : computeBackoffMs(r, cfg.backoffBaseMs, cfg.backoffMaxMs);
            await sleep(backoff, params.signal);
          }
          continue;
        }
        causes.push(`[${model}] HTTP ${String(status)} no reintentable: ${snippet}`);
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (e instanceof DeepSeekHttpError) {
          throw e;
        }
        if (e instanceof DeepSeekEmptyContentError) {
          causes.push(`${e.name}: ${e.message}`);
          break;
        }
        causes.push(`[${model}] ${msg}`);
        if (r + 1 < cfg.maxRetriesPerModel) {
          const backoff = computeBackoffMs(r, cfg.backoffBaseMs, cfg.backoffMaxMs);
          await sleep(backoff, params.signal);
        }
      }
    }
  }

  throw new DeepSeekCascadeExhaustedError(
    "Cascada DeepSeek agotada sin respuesta válida.",
    attempts,
    causes,
  );
}
