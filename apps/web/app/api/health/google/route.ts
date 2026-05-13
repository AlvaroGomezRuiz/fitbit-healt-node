import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { parseFitbitMasterFromEnv } from "@/lib/fitbit/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GoogleHealthWebhookBodySchema = z.record(z.string(), z.unknown());

interface HealthWebhookOkBody {
  readonly ok: true;
  readonly stub: true;
  readonly bodyParsed: boolean;
}

interface HealthWebhookSkippedMasterBody {
  readonly ok: true;
  readonly skipped: "FITBIT_ACTIVO";
}

interface HealthWebhookErrBody {
  readonly ok: false;
  readonly error: string;
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

function getProvidedWebhookSecret(request: Request, url: URL): string | undefined {
  const h = request.headers.get("x-health-webhook-secret");
  if (h !== null && h.trim() !== "") {
    return h.trim();
  }
  const bearer = extractBearerToken(request);
  if (bearer !== undefined) {
    return bearer;
  }
  const q1 = url.searchParams.get("health_webhook_secret");
  if (q1 !== null && q1.trim() !== "") {
    return q1.trim();
  }
  const q2 = url.searchParams.get("secret");
  if (q2 !== null && q2.trim() !== "") {
    return q2.trim();
  }
  return undefined;
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

async function parseOptionalJsonBody(request: Request): Promise<
  | { readonly status: "absent" }
  | { readonly status: "invalid_json" }
  | { readonly status: "invalid_shape" }
  | { readonly status: "ok"; readonly data: Readonly<Record<string, unknown>> }
> {
  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return { status: "absent" };
  }
  const text = await request.text();
  if (text.trim() === "") {
    return { status: "absent" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: "invalid_json" };
  }
  const checked = GoogleHealthWebhookBodySchema.safeParse(parsed);
  if (!checked.success) {
    return { status: "invalid_shape" };
  }
  return { status: "ok", data: checked.data };
}

export async function POST(
  request: Request,
): Promise<NextResponse<HealthWebhookOkBody | HealthWebhookErrBody | HealthWebhookSkippedMasterBody>> {
  if (!parseFitbitMasterFromEnv(process.env)) {
    const body: HealthWebhookSkippedMasterBody = { ok: true, skipped: "FITBIT_ACTIVO" };
    return NextResponse.json(body);
  }

  const expected = process.env.HEALTH_WEBHOOK_SECRET?.trim() ?? "";
  if (expected === "") {
    const body: HealthWebhookErrBody = { ok: false, error: "webhook_not_configured" };
    return NextResponse.json(body, { status: 503 });
  }

  const url = new URL(request.url);
  const provided = getProvidedWebhookSecret(request, url);
  if (provided === undefined || !safeEqualString(provided, expected)) {
    const body: HealthWebhookErrBody = { ok: false, error: "unauthorized" };
    return NextResponse.json(body, { status: 401 });
  }

  const parsedBody = await parseOptionalJsonBody(request);
  if (parsedBody.status === "invalid_json") {
    const body: HealthWebhookErrBody = { ok: false, error: "invalid_json" };
    return NextResponse.json(body, { status: 400 });
  }
  if (parsedBody.status === "invalid_shape") {
    const body: HealthWebhookErrBody = { ok: false, error: "invalid_body" };
    return NextResponse.json(body, { status: 422 });
  }

  const bodyParsed = parsedBody.status === "ok";
  const okBody: HealthWebhookOkBody = { ok: true, stub: true, bodyParsed };
  return NextResponse.json(okBody);
}
