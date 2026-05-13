import { NextResponse } from "next/server";

import { buildPreEntrenoSystemPrompt, buildPreEntrenoUserMessage } from "@/lib/ai/pre-entreno-prompt";
import { runDeepSeekCascade } from "@/lib/ai/reexport";
import { validateCronBearerSecret } from "@/lib/cron/cron-secret";
import {
  isWithinMadridHalfOpenMinuteWindow,
  madridCivilClockLabelHm,
  readPreEntrenoMadridWindowFromEnv,
} from "@/lib/cron/madrid-cron-window";
import { biometriaMaestroRowSchema, biometriaSelect } from "@/lib/data/biometria-maestro";
import { addDaysIsoUtc, todayMadridIso } from "@/lib/data/date-madrid";
import { type MemoriaIaRow, memoriaIaRowSchema, memoriaIaSelectColumns } from "@/lib/data/memoria-ia";
import { reporteHtmlRowSchema, reportesHtmlSelectColumns } from "@/lib/data/reportes-html";
import { telemetriaDiariaRowSchema, telemetriaDiariaSelectColumns } from "@/lib/data/telemetria-diaria";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CronPreEntrenoSkippedBody = {
  readonly ok: true;
  readonly skipped: string;
  readonly madridClock: string;
};

type CronPreEntrenoRanBody = {
  readonly ok: true;
  readonly ran: true;
  readonly fecha: string;
  readonly modelUsed: string;
  readonly attempts: number;
};

type CronPreEntrenoErrorBody = {
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
    CronPreEntrenoSkippedBody | CronPreEntrenoRanBody | CronPreEntrenoErrorBody | { readonly error: string }
  >
> {
  const auth = validateCronBearerSecret(request);
  if (auth.kind === "missing_cron_secret_env") {
    const body: CronPreEntrenoSkippedBody = {
      ok: true,
      skipped: "missing_cron_secret_env",
      madridClock: madridCivilClockLabelHm(new Date()),
    };
    return NextResponse.json(body);
  }
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const madridClock = madridCivilClockLabelHm(now);
  const win = readPreEntrenoMadridWindowFromEnv(process.env);
  if (
    !isWithinMadridHalfOpenMinuteWindow({
      when: now,
      startMin: win.startMin,
      endExclusiveMin: win.endExclusiveMin,
    })
  ) {
    const body: CronPreEntrenoSkippedBody = { ok: true, skipped: "outside_madrid_window", madridClock };
    return NextResponse.json(body);
  }

  if (!isTruthyEnvFlag(process.env.CRON_PRE_ENTRENO_DEEPSEEK)) {
    const body: CronPreEntrenoSkippedBody = { ok: true, skipped: "cron_ai_disabled", madridClock };
    return NextResponse.json(body);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    const body: CronPreEntrenoSkippedBody = { ok: true, skipped: "missing_deepseek_api_key", madridClock };
    return NextResponse.json(body);
  }

  const supabase = createSupabaseServiceRoleClient();
  if (supabase === null) {
    const body: CronPreEntrenoSkippedBody = { ok: true, skipped: "missing_service_role_env", madridClock };
    return NextResponse.json(body);
  }

  const fecha = todayMadridIso();
  const fechaNochePrev = addDaysIsoUtc(fecha, -1);

  const { data: bioRaw, error: bioErr } = await supabase
    .from("biometria_maestro")
    .select(biometriaSelect)
    .maybeSingle();

  if (bioErr !== null) {
    const body: CronPreEntrenoSkippedBody = { ok: true, skipped: "biometria_query_error", madridClock };
    return NextResponse.json(body);
  }
  if (bioRaw === null) {
    const body: CronPreEntrenoErrorBody = { ok: false, error: "missing_biometria" };
    return NextResponse.json(body, { status: 422 });
  }

  const bioParsed = biometriaMaestroRowSchema.safeParse(bioRaw);
  if (!bioParsed.success) {
    const body: CronPreEntrenoSkippedBody = { ok: true, skipped: "biometria_row_shape", madridClock };
    return NextResponse.json(body);
  }
  const bio = bioParsed.data;

  const { data: teleRaw, error: teleErr } = await supabase
    .from("telemetria_diaria")
    .select(telemetriaDiariaSelectColumns)
    .eq("fecha", fechaNochePrev)
    .maybeSingle();

  let teleNochePrev = null;
  if (teleErr === null && teleRaw !== null) {
    const teleParsed = telemetriaDiariaRowSchema.safeParse(teleRaw);
    if (teleParsed.success) {
      teleNochePrev = teleParsed.data;
    }
  }

  const { data: resumenRaw, error: resumenErr } = await supabase
    .from("reportes_html")
    .select(reportesHtmlSelectColumns)
    .eq("tipo", "RESUMEN_NOCHE")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  let ultimoResumenNoche = null;
  if (resumenErr === null && resumenRaw !== null) {
    const r = reporteHtmlRowSchema.safeParse(resumenRaw);
    if (r.success) {
      ultimoResumenNoche = r.data;
    }
  }

  const { data: memData, error: memErr } = await supabase
    .from("memoria_ia")
    .select(memoriaIaSelectColumns)
    .order("created_at", { ascending: false })
    .limit(40);

  const memoriaTail: MemoriaIaRow[] = [];
  if (memErr === null && memData !== null) {
    for (const row of memData) {
      const m = memoriaIaRowSchema.safeParse(row);
      if (m.success) {
        memoriaTail.push(m.data);
      }
    }
  }

  const systemPrompt = buildPreEntrenoSystemPrompt();
  const userMessage = buildPreEntrenoUserMessage({
    fechaMadrid: fecha,
    telemetriaNochePrev: teleNochePrev,
    ultimoResumenNoche,
    memoriaTail,
    biometria: bio,
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
    const body: CronPreEntrenoErrorBody = { ok: false, error: "deepseek_failed" };
    return NextResponse.json(body, { status: 500 });
  }

  const nombreArchivo = `pre_entreno_${fecha}.html`;
  const { error: upsertErr } = await supabase.from("reportes_html").upsert(
    {
      fecha,
      tipo: "PRE_ENTRENO",
      nombre_archivo: nombreArchivo,
      drive_file_id: null,
      html_content: result.text.trim(),
    },
    { onConflict: "fecha,tipo" },
  );

  if (upsertErr !== null) {
    const body: CronPreEntrenoErrorBody = { ok: false, error: "persist_failed" };
    return NextResponse.json(body, { status: 500 });
  }

  const body: CronPreEntrenoRanBody = {
    ok: true,
    ran: true,
    fecha,
    modelUsed: result.modelUsed,
    attempts: result.attempts,
  };
  return NextResponse.json(body);
}
