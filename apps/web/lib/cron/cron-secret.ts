import { timingSafeEqual } from "node:crypto";

/**
 * Extrae el token Bearer del header `Authorization` (case-insensitive en el prefijo).
 */
export function extractBearerTokenFromAuthorizationHeader(request: Request): string | undefined {
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

function timingSafeEqualUtf8(a: string, b: string): boolean {
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

export function readTrimmedCronSecretFromEnv(): string {
  const cronSecret = process.env.CRON_SECRET;
  return cronSecret?.trim() ?? "";
}

export type CronBearerAuthResult =
  | { readonly kind: "authorized" }
  | { readonly kind: "missing_cron_secret_env" }
  | { readonly kind: "unauthorized" };

/**
 * Valida que la petición lleve `Authorization: Bearer` igual a `CRON_SECRET` (timing-safe).
 */
export function validateCronBearerSecret(request: Request): CronBearerAuthResult {
  const cronSecretTrimmed = readTrimmedCronSecretFromEnv();
  if (cronSecretTrimmed === "") {
    return { kind: "missing_cron_secret_env" };
  }
  const token = extractBearerTokenFromAuthorizationHeader(request);
  if (token === undefined || !timingSafeEqualUtf8(token, cronSecretTrimmed)) {
    return { kind: "unauthorized" };
  }
  return { kind: "authorized" };
}

/** Cuerpo JSON estable para `401` en rutas cron (Vercel / clientes de inspección). */
export const CRON_UNAUTHORIZED_JSON_BODY = { ok: false, error: "unauthorized" } as const;
