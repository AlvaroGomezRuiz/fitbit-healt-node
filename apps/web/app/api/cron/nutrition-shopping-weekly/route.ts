import { NextResponse } from "next/server";

import { biometriaMaestroRowSchema, biometriaSelect } from "@/lib/data/biometria-maestro";
import { buildEntrenosHistoricoContextForPrompt } from "@/lib/data/build-entrenos-historico-context";
import { isSundayEuropeMadrid, todayMadridIso } from "@/lib/data/date-madrid";
import { CRON_UNAUTHORIZED_JSON_BODY, validateCronBearerSecret } from "@/lib/cron/cron-secret";
import {
  isWithinMadridHalfOpenMinuteWindow,
  madridCivilClockLabelHm,
  readNutritionShoppingSundayMadridWindowFromEnv,
} from "@/lib/cron/madrid-cron-window";
import { revalidateAfterSundayShoppingWrite } from "@/lib/cache/revalidate-after-data-write";
import {
  generateSundayShoppingMarkdown,
  persistSundayShoppingMarkdownToMemoriaIa,
} from "@/lib/nutrition/sunday-shopping-generation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CronNutritionShoppingSkippedBody = {
  readonly ok: true;
  readonly skipped: string;
  readonly madridClock: string;
};

type CronNutritionShoppingRanBody = {
  readonly ok: true;
  readonly ran: true;
  readonly fecha: string;
  readonly modelUsed: string;
  readonly attempts: number;
};

type CronNutritionShoppingErrorBody = {
  readonly ok: false;
  readonly error: "deepseek_failed" | "persist_failed" | "missing_biometria";
};

function isTruthyEnvFlag(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const t = value.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes" || t === "on";
}

export async function GET(request: Request): Promise<
  NextResponse<
    | CronNutritionShoppingSkippedBody
    | CronNutritionShoppingRanBody
    | CronNutritionShoppingErrorBody
    | typeof CRON_UNAUTHORIZED_JSON_BODY
  >
> {
  const auth = validateCronBearerSecret(request);
  if (auth.kind === "missing_cron_secret_env") {
    const body: CronNutritionShoppingSkippedBody = {
      ok: true,
      skipped: "missing_cron_secret_env",
      madridClock: madridCivilClockLabelHm(new Date()),
    };
    return NextResponse.json(body);
  }
  if (auth.kind === "unauthorized") {
    return NextResponse.json(CRON_UNAUTHORIZED_JSON_BODY, { status: 401 });
  }

  const now = new Date();
  const madridClock = madridCivilClockLabelHm(now);
  const bypassMadridSundayGuards = isTruthyEnvFlag(process.env.CRON_NUTRITION_SHOPPING_BYPASS_WINDOW);

  if (!bypassMadridSundayGuards) {
    const win = readNutritionShoppingSundayMadridWindowFromEnv(process.env);
    if (
      !isWithinMadridHalfOpenMinuteWindow({
        when: now,
        startMin: win.startMin,
        endExclusiveMin: win.endExclusiveMin,
      })
    ) {
      const body: CronNutritionShoppingSkippedBody = { ok: true, skipped: "outside_madrid_window", madridClock };
      return NextResponse.json(body);
    }
  }

  const fecha = todayMadridIso();
  if (!bypassMadridSundayGuards && !isSundayEuropeMadrid(fecha)) {
    const body: CronNutritionShoppingSkippedBody = { ok: true, skipped: "not_sunday_madrid", madridClock };
    return NextResponse.json(body);
  }

  if (!isTruthyEnvFlag(process.env.CRON_NUTRITION_SHOPPING_DEEPSEEK)) {
    const body: CronNutritionShoppingSkippedBody = { ok: true, skipped: "cron_ai_disabled", madridClock };
    return NextResponse.json(body);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    const body: CronNutritionShoppingSkippedBody = { ok: true, skipped: "missing_deepseek_api_key", madridClock };
    return NextResponse.json(body);
  }

  const supabase = createSupabaseServiceRoleClient();
  if (supabase === null) {
    const body: CronNutritionShoppingSkippedBody = { ok: true, skipped: "missing_service_role_env", madridClock };
    return NextResponse.json(body);
  }

  const { data: bioRaw, error: bioErr } = await supabase
    .from("biometria_maestro")
    .select(biometriaSelect)
    .maybeSingle();

  if (bioErr !== null) {
    const body: CronNutritionShoppingSkippedBody = { ok: true, skipped: "biometria_query_error", madridClock };
    return NextResponse.json(body);
  }
  if (bioRaw === null) {
    const body: CronNutritionShoppingErrorBody = { ok: false, error: "missing_biometria" };
    return NextResponse.json(body, { status: 422 });
  }

  const bioParsed = biometriaMaestroRowSchema.safeParse(bioRaw);
  if (!bioParsed.success) {
    const body: CronNutritionShoppingSkippedBody = { ok: true, skipped: "biometria_row_shape", madridClock };
    return NextResponse.json(body);
  }

  const entrenosHistoricoCompact = await buildEntrenosHistoricoContextForPrompt({
    supabase,
    maxSessions: 10,
    maxChars: 2000,
  });

  const gen = await generateSundayShoppingMarkdown({
    biometria: bioParsed.data,
    fechaVista: fecha,
    entrenosHistoricoCompact,
  });

  if (gen.ok === false) {
    const body: CronNutritionShoppingErrorBody = { ok: false, error: "deepseek_failed" };
    return NextResponse.json(body, { status: 500 });
  }

  const persist = await persistSundayShoppingMarkdownToMemoriaIa({
    supabase,
    markdown: gen.markdown,
    fechaVista: fecha,
  });
  if (persist.ok === false) {
    const body: CronNutritionShoppingErrorBody = { ok: false, error: "persist_failed" };
    return NextResponse.json(body, { status: 500 });
  }

  revalidateAfterSundayShoppingWrite();

  const body: CronNutritionShoppingRanBody = {
    ok: true,
    ran: true,
    fecha,
    modelUsed: gen.modelUsed,
    attempts: gen.attempts,
  };
  return NextResponse.json(body);
}
