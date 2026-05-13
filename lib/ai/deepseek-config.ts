import { DeepSeekConfigError } from "./errors.js";

function readEnvString(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined || v.trim() === "") {
    return undefined;
  }
  return v.trim();
}

function readEnvInt(key: string, fallback: number): number {
  const raw = readEnvString(key);
  if (raw === undefined) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return n;
}

export interface DeepSeekClientConfig {
  readonly apiKey: string;
  readonly chatCompletionsUrl: string;
  readonly modelCascadeDefault: readonly string[];
  readonly maxRetriesPerModel: number;
  readonly backoffBaseMs: number;
  readonly backoffMaxMs: number;
  readonly requestTimeoutMs: number;
}

function parseModelCascade(raw: string | undefined): readonly string[] {
  if (raw === undefined) {
    return ["deepseek-v4-pro", "deepseek-v4-flash"];
  }
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) {
    return ["deepseek-v4-pro", "deepseek-v4-flash"];
  }
  return dedupeModels(parts);
}

function dedupeModels(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of items) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

/**
 * Lee configuración desde process.env (sin validar la key en build time).
 */
export function loadDeepSeekClientConfigFromEnv(): DeepSeekClientConfig {
  const apiKey = readEnvString("DEEPSEEK_API_KEY");
  if (apiKey === undefined) {
    throw new DeepSeekConfigError("Falta DEEPSEEK_API_KEY en el entorno.");
  }

  const baseUrl =
    readEnvString("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com/chat/completions";

  const explicitCascade = readEnvString("DEEPSEEK_MODEL_CASCADE");
  const modelCascadeDefault =
    explicitCascade !== undefined
      ? dedupeModels([...parseModelCascade(explicitCascade)])
      : dedupeModels(
          parseModelCascade(
            [
              readEnvString("DEEPSEEK_MODEL_COMPLEX"),
              "deepseek-v4-pro",
              "deepseek-v4-flash",
            ]
              .filter((x): x is string => x !== undefined)
              .join(","),
          ),
        );

  return {
    apiKey,
    chatCompletionsUrl: baseUrl,
    modelCascadeDefault,
    maxRetriesPerModel: readEnvInt("DEEPSEEK_MAX_RETRIES", 3),
    backoffBaseMs: readEnvInt("DEEPSEEK_BACKOFF_BASE_MS", 1000),
    backoffMaxMs: readEnvInt("DEEPSEEK_BACKOFF_MAX_MS", 16000),
    requestTimeoutMs: readEnvInt("DEEPSEEK_TIMEOUT_MS", 180_000),
  };
}
