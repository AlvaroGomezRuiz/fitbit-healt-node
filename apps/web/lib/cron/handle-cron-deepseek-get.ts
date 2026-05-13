import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runDeepSeekCascade } from "@/lib/ai/reexport";
import { parseFitbitMasterFromEnv } from "@/lib/fitbit/config";

export type CronDeepSeekFlagEnv =
  | "CRON_PRE_ENTRENO_DEEPSEEK"
  | "CRON_RESUMEN_NOCHE_DEEPSEEK";

interface CronSkippedBody {
  readonly ok: true;
  readonly skipped: string;
}

interface CronRanBody {
  readonly ok: true;
  readonly ran: true;
  readonly modelUsed: string;
  readonly attempts: number;
}

interface CronDeepSeekErrorBody {
  readonly ok: false;
  readonly error: "deepseek_failed";
}

function extractBearerToken(request: Request): string | undefined {
  const raw = request.headers.get("authorization");
  if (raw === null) {
    return undefined;
  }
  const trimmed = raw.trim();
  const prefix = "Bearer ";
  if (!trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return undefined;
  }
  const token = trimmed.slice(prefix.length).trim();
  return token === "" ? undefined : token;
}

function safeEqualString(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) {
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function isTruthyEnvFlag(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const t = value.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes" || t === "on";
}

/**
 * GET de cron Vercel: valida Bearer CRON_SECRET; si `FITBIT_ACTIVO` no está activo, responde skipped sin llamar a DeepSeek;
 * si hay key y flag por job, invoca la cascada.
 */
export async function handleCronDeepSeekGet(params: {
  readonly request: Request;
  readonly aiFlagEnv: CronDeepSeekFlagEnv;
  readonly prompt: string;
}): Promise<NextResponse<CronSkippedBody | CronRanBody | CronDeepSeekErrorBody | { readonly error: string }>> {
  const cronSecret = process.env.CRON_SECRET;
  const cronSecretTrimmed = cronSecret?.trim() ?? "";
  if (cronSecretTrimmed === "") {
    const body: CronSkippedBody = { ok: true, skipped: "missing_cron_secret_env" };
    return NextResponse.json(body);
  }

  const token = extractBearerToken(params.request);
  if (token === undefined || !safeEqualString(token, cronSecretTrimmed)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!parseFitbitMasterFromEnv(process.env)) {
    const body: CronSkippedBody = { ok: true, skipped: "FITBIT_ACTIVO" };
    return NextResponse.json(body);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    const body: CronSkippedBody = { ok: true, skipped: "missing_deepseek_api_key" };
    return NextResponse.json(body);
  }

  if (!isTruthyEnvFlag(process.env[params.aiFlagEnv])) {
    const body: CronSkippedBody = { ok: true, skipped: "cron_ai_disabled" };
    return NextResponse.json(body);
  }

  try {
    const result = await runDeepSeekCascade({
      messages: [{ role: "user", content: params.prompt }],
      temperature: 0.15,
      signal: undefined,
    });
    const body: CronRanBody = {
      ok: true,
      ran: true,
      modelUsed: result.modelUsed,
      attempts: result.attempts,
    };
    return NextResponse.json(body);
  } catch {
    const body: CronDeepSeekErrorBody = { ok: false, error: "deepseek_failed" };
    return NextResponse.json(body, { status: 500 });
  }
}
