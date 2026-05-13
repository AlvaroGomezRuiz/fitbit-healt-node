import { NextResponse } from "next/server";

import { validateCronBearerSecret } from "@/lib/cron/cron-secret";
import {
  FITBIT_PULL_DEFAULT_END_EXCLUSIVE_MIN,
  FITBIT_PULL_DEFAULT_START_MIN,
  isWithinMadridHalfOpenMinuteWindow,
  madridCivilClockLabelHm,
} from "@/lib/cron/madrid-cron-window";
import { parseFitbitFeatureFlagsFromEnv, parseFitbitMasterFromEnv } from "@/lib/fitbit/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FitbitPullSkipped = { readonly ok: true; readonly skipped: string; readonly madridClock: string };
type FitbitPullRanStub = { readonly ok: true; readonly ran: true; readonly note: "fetch_not_wired" };

/**
 * Cron GET: ventana Madrid [08:35, 08:50) + flags Fitbit; la ingesta remota real va en worker externo o futuro cliente HTTP.
 */
export async function GET(request: Request): Promise<NextResponse<FitbitPullSkipped | FitbitPullRanStub | { readonly error: string }>> {
  const auth = validateCronBearerSecret(request);
  if (auth.kind === "missing_cron_secret_env") {
    const body: FitbitPullSkipped = { ok: true, skipped: "missing_cron_secret_env", madridClock: madridCivilClockLabelHm(new Date()) };
    return NextResponse.json(body);
  }
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const madridClock = madridCivilClockLabelHm(now);
  if (
    !isWithinMadridHalfOpenMinuteWindow({
      when: now,
      startMin: FITBIT_PULL_DEFAULT_START_MIN,
      endExclusiveMin: FITBIT_PULL_DEFAULT_END_EXCLUSIVE_MIN,
    })
  ) {
    const body: FitbitPullSkipped = { ok: true, skipped: "outside_madrid_window", madridClock };
    return NextResponse.json(body);
  }

  if (!parseFitbitMasterFromEnv(process.env)) {
    const body: FitbitPullSkipped = { ok: true, skipped: "FITBIT_ACTIVO", madridClock };
    return NextResponse.json(body);
  }

  const flags = parseFitbitFeatureFlagsFromEnv(process.env);
  if (!flags.ingestEnabled) {
    const body: FitbitPullSkipped = { ok: true, skipped: "FITBIT_INGEST_DISABLED", madridClock };
    return NextResponse.json(body);
  }

  // TODO: fetch remoto Fitbit/Google Health + POST interno a /api/fitbit/ingest (cuerpo validado).
  const body: FitbitPullRanStub = { ok: true, ran: true, note: "fetch_not_wired" };
  return NextResponse.json(body);
}
