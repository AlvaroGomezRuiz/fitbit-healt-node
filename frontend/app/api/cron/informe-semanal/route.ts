import { NextResponse } from "next/server";

import { addDaysIsoUtc, isSundayEuropeMadrid, mondayOfWeekMadridIso, todayMadridIso } from "@/lib/data/date-madrid";
import { telemetriaDiariaRowSchema, telemetriaDiariaSelectColumns, type TelemetriaDiariaRow } from "@/lib/data/telemetria-diaria";
import { CRON_UNAUTHORIZED_JSON_BODY, validateCronBearerSecret } from "@/lib/cron/cron-secret";
import {
  isWithinMadridHalfOpenMinuteWindow,
  madridCivilClockLabelHm,
  readInformeSemanalSundayMadridWindowFromEnv,
} from "@/lib/cron/madrid-cron-window";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CronInformeSkippedBody = {
  readonly ok: true;
  readonly skipped: string;
  readonly madridClock: string;
};

type CronInformeRanBody = {
  readonly ok: true;
  readonly ran: true;
  readonly semana_inicio: string;
  readonly filas_telemetria: number;
};

type CronInformeErrorBody = {
  readonly ok: false;
  readonly error: "telemetria_read_failed" | "persist_failed";
};

function isTruthyEnvFlag(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const t = value.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes" || t === "on";
}

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNum(n: number | null): string {
  if (n === null || Number.isNaN(n)) {
    return "—";
  }
  return String(n);
}

function buildWeeklyHtml(params: {
  readonly semanaInicio: string;
  readonly semanaFin: string;
  readonly rows: readonly TelemetriaDiariaRow[];
}): string {
  const title = `Semana ${escapeHtmlText(params.semanaInicio)} → ${escapeHtmlText(params.semanaFin)}`;
  const head =
    `<article class="informe-semanal"><header><h1>Informe semanal</h1><p>${title}</p></header>` +
    "<p>Resumen automático desde telemetría diaria (sin IA).</p>";
  if (params.rows.length === 0) {
    return `${head}<p>Sin filas en <code>telemetria_diaria</code> para esta semana.</p></article>`;
  }
  const rowsHtml = params.rows
    .map((r) => {
      const f = escapeHtmlText(r.fecha);
      return `<tr><td>${f}</td><td>${formatNum(r.pasos)}</td><td>${formatNum(r.sueno_horas)}</td><td>${formatNum(
        r.calorias_total,
      )}</td></tr>`;
    })
    .join("");
  const table = `<table><thead><tr><th>Fecha</th><th>Pasos</th><th>Sueño h</th><th>Kcal</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
  return `${head}${table}</article>`;
}

const createdAtOnlySchema = z.object({ created_at: z.string() });

export async function GET(request: Request): Promise<
  NextResponse<CronInformeSkippedBody | CronInformeRanBody | CronInformeErrorBody | typeof CRON_UNAUTHORIZED_JSON_BODY>
> {
  const auth = validateCronBearerSecret(request);
  const madridClock = madridCivilClockLabelHm(new Date());
  if (auth.kind === "missing_cron_secret_env") {
    const body: CronInformeSkippedBody = { ok: true, skipped: "missing_cron_secret_env", madridClock };
    return NextResponse.json(body);
  }
  if (auth.kind === "unauthorized") {
    return NextResponse.json(CRON_UNAUTHORIZED_JSON_BODY, { status: 401 });
  }

  const now = new Date();
  const fecha = todayMadridIso();
  const bypassWindow = isTruthyEnvFlag(process.env.CRON_INFORME_SEMANAL_BYPASS_WINDOW);
  if (!bypassWindow) {
    const win = readInformeSemanalSundayMadridWindowFromEnv(process.env);
    if (
      !isWithinMadridHalfOpenMinuteWindow({
        when: now,
        startMin: win.startMin,
        endExclusiveMin: win.endExclusiveMin,
      })
    ) {
      const body: CronInformeSkippedBody = { ok: true, skipped: "outside_madrid_window", madridClock };
      return NextResponse.json(body);
    }
    if (!isSundayEuropeMadrid(fecha)) {
      const body: CronInformeSkippedBody = { ok: true, skipped: "not_sunday_madrid", madridClock };
      return NextResponse.json(body);
    }
  }

  const supabase = createSupabaseServiceRoleClient();
  if (supabase === null) {
    const body: CronInformeSkippedBody = { ok: true, skipped: "missing_service_role_env", madridClock };
    return NextResponse.json(body);
  }

  const semanaInicio = mondayOfWeekMadridIso(fecha);
  const semanaFin = addDaysIsoUtc(semanaInicio, 6);

  const { data: teleRaw, error: teleErr } = await supabase
    .from("telemetria_diaria")
    .select(telemetriaDiariaSelectColumns)
    .gte("fecha", semanaInicio)
    .lte("fecha", semanaFin)
    .order("fecha", { ascending: true });

  if (teleErr !== null) {
    const body: CronInformeErrorBody = { ok: false, error: "telemetria_read_failed" };
    return NextResponse.json(body, { status: 500 });
  }

  const teleParsed = z.array(telemetriaDiariaRowSchema).safeParse(teleRaw ?? []);
  if (!teleParsed.success) {
    const body: CronInformeErrorBody = { ok: false, error: "telemetria_read_failed" };
    return NextResponse.json(body, { status: 500 });
  }

  const html = buildWeeklyHtml({
    semanaInicio,
    semanaFin,
    rows: teleParsed.data,
  });

  const { data: existing, error: exErr } = await supabase
    .from("reporte_semanal")
    .select("created_at")
    .eq("semana_inicio", semanaInicio)
    .maybeSingle();

  if (exErr !== null) {
    const body: CronInformeErrorBody = { ok: false, error: "persist_failed" };
    return NextResponse.json(body, { status: 500 });
  }

  const createdParsed = existing === null ? null : createdAtOnlySchema.safeParse(existing);
  const createdAt =
    createdParsed !== null && createdParsed.success ? createdParsed.data.created_at : new Date().toISOString();
  const updatedAt = new Date().toISOString();

  const { error: upsertErr } = await supabase.from("reporte_semanal").upsert(
    {
      semana_inicio: semanaInicio,
      html_content: html,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    { onConflict: "semana_inicio" },
  );

  if (upsertErr !== null) {
    const body: CronInformeErrorBody = { ok: false, error: "persist_failed" };
    return NextResponse.json(body, { status: 500 });
  }

  const body: CronInformeRanBody = {
    ok: true,
    ran: true,
    semana_inicio: semanaInicio,
    filas_telemetria: teleParsed.data.length,
  };
  return NextResponse.json(body);
}
