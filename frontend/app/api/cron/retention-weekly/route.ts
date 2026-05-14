import { NextResponse } from "next/server";

import { CRON_UNAUTHORIZED_JSON_BODY, validateCronBearerSecret } from "@/lib/cron/cron-secret";
import { madridCivilClockLabelHm } from "@/lib/cron/madrid-cron-window";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const retentionRpcPayloadSchema = z.record(z.string(), z.unknown());

type CronRetentionSkippedBody = {
  readonly ok: true;
  readonly skipped: string;
  readonly madridClock: string;
};

type CronRetentionRanBody = {
  readonly ok: true;
  readonly ran: true;
  readonly pDays: number;
  readonly result: Readonly<Record<string, unknown>>;
};

function readRetentionPurgeDaysFromEnv(): number {
  const raw = process.env.CRON_RETENTION_PURGE_DAYS?.trim();
  if (raw === undefined || raw === "") {
    return 120;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 30 || n > 400) {
    return 120;
  }
  return n;
}

export async function GET(request: Request): Promise<
  NextResponse<CronRetentionSkippedBody | CronRetentionRanBody | typeof CRON_UNAUTHORIZED_JSON_BODY>
> {
  const auth = validateCronBearerSecret(request);
  const madridClock = madridCivilClockLabelHm(new Date());
  if (auth.kind === "missing_cron_secret_env") {
    const body: CronRetentionSkippedBody = { ok: true, skipped: "missing_cron_secret_env", madridClock };
    return NextResponse.json(body);
  }
  if (auth.kind === "unauthorized") {
    return NextResponse.json(CRON_UNAUTHORIZED_JSON_BODY, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  if (supabase === null) {
    const body: CronRetentionSkippedBody = { ok: true, skipped: "missing_service_role_env", madridClock };
    return NextResponse.json(body);
  }

  const pDays = readRetentionPurgeDaysFromEnv();
  const { data, error } = await supabase.rpc("retention_run_purge", { p_days: pDays });
  if (error !== null) {
    const body: CronRetentionSkippedBody = {
      ok: true,
      skipped: `rpc_error:${error.message}`,
      madridClock,
    };
    return NextResponse.json(body);
  }

  const parsed = retentionRpcPayloadSchema.safeParse(data);
  if (!parsed.success) {
    const body: CronRetentionSkippedBody = {
      ok: true,
      skipped: "rpc_payload_shape",
      madridClock,
    };
    return NextResponse.json(body);
  }

  const body: CronRetentionRanBody = { ok: true, ran: true, pDays, result: parsed.data };
  return NextResponse.json(body);
}
