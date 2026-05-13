import { NextResponse } from "next/server";

import {
  buildNutritionDailyRoutineSystemPrompt,
  buildNutritionDailyRoutineUserMessage,
} from "@/lib/ai/nutrition-daily-routine-prompt";
import { runDeepSeekCascade } from "@/lib/ai/reexport";
import { validateCronBearerSecret } from "@/lib/cron/cron-secret";
import { biometriaMaestroRowSchema, biometriaSelect } from "@/lib/data/biometria-maestro";
import { addDaysIsoUtc, diaSemanaDbFromMadridIso, todayMadridIso } from "@/lib/data/date-madrid";
import type { DiaSemanaDb } from "@/lib/data/rutina-oficial";
import { fetchRutinaOficialDetailByDia } from "@/lib/data/rutina-oficial";
import { telemetriaDiariaRowSchema, telemetriaDiariaSelectColumns } from "@/lib/data/telemetria-diaria";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CronDailyNutritionSkippedBody = {
  readonly ok: true;
  readonly skipped: string;
};

type CronDailyNutritionRanBody = {
  readonly ok: true;
  readonly ran: true;
  readonly fecha: string;
  readonly modelUsed: string;
  readonly attempts: number;
};

type CronDailyNutritionErrorBody = {
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
    CronDailyNutritionSkippedBody | CronDailyNutritionRanBody | CronDailyNutritionErrorBody | { readonly error: string }
  >
> {
  const auth = validateCronBearerSecret(request);
  if (auth.kind === "missing_cron_secret_env") {
    const body: CronDailyNutritionSkippedBody = { ok: true, skipped: "missing_cron_secret_env" };
    return NextResponse.json(body);
  }
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTruthyEnvFlag(process.env.CRON_DAILY_NUTRITION_DEEPSEEK)) {
    const body: CronDailyNutritionSkippedBody = { ok: true, skipped: "cron_ai_disabled" };
    return NextResponse.json(body);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    const body: CronDailyNutritionSkippedBody = { ok: true, skipped: "missing_deepseek_api_key" };
    return NextResponse.json(body);
  }

  const supabase = createSupabaseServiceRoleClient();
  if (supabase === null) {
    const body: CronDailyNutritionSkippedBody = { ok: true, skipped: "missing_service_role_env" };
    return NextResponse.json(body);
  }

  const fecha = todayMadridIso();
  const diaMadrid: DiaSemanaDb = diaSemanaDbFromMadridIso(fecha);

  const { data: bioRaw, error: bioErr } = await supabase
    .from("biometria_maestro")
    .select(biometriaSelect)
    .maybeSingle();

  if (bioErr !== null) {
    const body: CronDailyNutritionSkippedBody = { ok: true, skipped: "biometria_query_error" };
    return NextResponse.json(body);
  }
  if (bioRaw === null) {
    const body: CronDailyNutritionErrorBody = { ok: false, error: "missing_biometria" };
    return NextResponse.json(body, { status: 422 });
  }

  const bioParsed = biometriaMaestroRowSchema.safeParse(bioRaw);
  if (!bioParsed.success) {
    const body: CronDailyNutritionSkippedBody = { ok: true, skipped: "biometria_row_shape" };
    return NextResponse.json(body);
  }
  const bio = bioParsed.data;

  const rutina = await fetchRutinaOficialDetailByDia({ supabase, dia: diaMadrid });
  if (!rutina.ok) {
    const body: CronDailyNutritionSkippedBody = { ok: true, skipped: "rutina_query_error" };
    return NextResponse.json(body);
  }

  const fechaAyer = addDaysIsoUtc(fecha, -1);
  const { data: teleRaw, error: teleErr } = await supabase
    .from("telemetria_diaria")
    .select(telemetriaDiariaSelectColumns)
    .eq("fecha", fechaAyer)
    .maybeSingle();

  let teleAyerParsed: ReturnType<typeof telemetriaDiariaRowSchema.safeParse> | null = null;
  if (teleErr === null && teleRaw !== null) {
    teleAyerParsed = telemetriaDiariaRowSchema.safeParse(teleRaw);
  }

  const teleAyer =
    teleAyerParsed !== null && teleAyerParsed.success ? teleAyerParsed.data : null;

  const systemPrompt = buildNutritionDailyRoutineSystemPrompt({
    kcalTarget: bio.kcal_target,
    proteinG: bio.proteina_g,
    carbosG: bio.carbos_g,
    grasaG: bio.grasa_g,
    creatinaG: bio.creatina_g,
    aguaL: bio.agua_l,
  });

  const userMessage = buildNutritionDailyRoutineUserMessage({
    fechaMadrid: fecha,
    diaSemanaEtiqueta: diaMadrid,
    rutina: rutina.row,
    telemetriaAyer: teleAyer,
  });

  let result: { text: string; modelUsed: string; attempts: number };
  try {
    result = await runDeepSeekCascade({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      signal: undefined,
    });
  } catch {
    const body: CronDailyNutritionErrorBody = { ok: false, error: "deepseek_failed" };
    return NextResponse.json(body, { status: 500 });
  }

  const { error: upsertErr } = await supabase.from("diario_plan_ia").upsert(
    {
      fecha,
      markdown: result.text,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "fecha" },
  );

  if (upsertErr !== null) {
    const body: CronDailyNutritionErrorBody = { ok: false, error: "persist_failed" };
    return NextResponse.json(body, { status: 500 });
  }

  const body: CronDailyNutritionRanBody = {
    ok: true,
    ran: true,
    fecha,
    modelUsed: result.modelUsed,
    attempts: result.attempts,
  };
  return NextResponse.json(body);
}
