import "server-only";

import { fetchBiometriaMaestro } from "@/lib/data/biometria-maestro";
import {
  addDaysIsoUtc,
  currentHourEuropeMadrid,
  diaSemanaDbFromMadridIso,
  isSundayEuropeMadrid,
  todayMadridIso,
} from "@/lib/data/date-madrid";
import { fetchDiarioPlanIa } from "@/lib/data/diario-plan-ia";
import { countEntrenosSessionDateGte, fetchUltimaSesionEntreno } from "@/lib/data/entrenos-historico";
import { listMemoriaIaRecent } from "@/lib/data/memoria-ia";
import { fetchReporteHtmlByFechaYTipo, listReportesHtmlRecent } from "@/lib/data/reportes-html";
import { fetchLatestTelemetriaDiaria } from "@/lib/data/telemetria-diaria";
import { fetchRutinaOficial } from "@/lib/data/rutina-oficial";
import { fetchWeeklyObjectiveHome, type HomeWeeklyObjectiveBlock } from "@/lib/data/weekly-objective-home";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { BiometriaMaestroRow } from "@/lib/data/biometria-maestro";
import type { DiarioPlanIaRow } from "@/lib/data/diario-plan-ia";
import type { EntrenoSessionPeek } from "@/lib/data/entrenos-historico";
import type { MemoriaIaRow } from "@/lib/data/memoria-ia";
import type { ReporteHtmlRow } from "@/lib/data/reportes-html";
import type { RutinaOficialRow } from "@/lib/data/rutina-oficial";
import type { TelemetriaDiariaRow } from "@/lib/data/telemetria-diaria";

export type HomeDataBlock<T> =
  | { readonly state: "ok"; readonly data: T }
  | { readonly state: "empty" }
  | { readonly state: "error"; readonly message: string };

/** Bloque de telemetría en portada: incluye rama cuando la UI Fitbit está desactivada por env. */
export type HomeTelemetriaLatestBlock =
  | { readonly state: "disabled" }
  | { readonly state: "ok"; readonly data: TelemetriaDiariaRow }
  | { readonly state: "empty" }
  | { readonly state: "error"; readonly message: string };

export type HomeDiarioPlanHoyBlock =
  | { readonly state: "ok"; readonly data: DiarioPlanIaRow }
  | { readonly state: "no_plan" }
  | { readonly state: "error"; readonly message: string };

export type HomeEntrenos7dCountBlock =
  | { readonly state: "ok"; readonly count: number }
  | { readonly state: "error"; readonly message: string };

export type HomeRutinaHoyBlock =
  | { readonly state: "ok"; readonly data: RutinaOficialRow }
  | { readonly state: "empty" }
  | { readonly state: "error"; readonly message: string };

export interface HomeDashboardMeta {
  readonly fechaCivilMadrid: string;
  readonly fechaCivilMadridLegible: string;
  /** Domingo en Madrid y hora local antes de las 14:00 (ventana mañana para peso ayunas). */
  readonly showDomingoPesoVentana: boolean;
  readonly usuarioAutenticado: boolean;
}

export type HomeReporteHoyBlock =
  | { readonly state: "ok"; readonly data: ReporteHtmlRow }
  | { readonly state: "empty" }
  | { readonly state: "error"; readonly message: string };

export interface HomeDashboardPayload {
  readonly meta: HomeDashboardMeta;
  readonly weeklyObjective: HomeWeeklyObjectiveBlock;
  readonly biometria: HomeDataBlock<BiometriaMaestroRow>;
  readonly telemetriaLatest: HomeTelemetriaLatestBlock;
  readonly reportes: HomeDataBlock<readonly ReporteHtmlRow[]>;
  readonly memoriaLines: HomeDataBlock<readonly MemoriaIaRow[]>;
  readonly ultimaSesion: HomeDataBlock<EntrenoSessionPeek>;
  readonly diarioPlanHoy: HomeDiarioPlanHoyBlock;
  readonly entrenos7dCount: HomeEntrenos7dCountBlock;
  readonly rutinaHoy: HomeRutinaHoyBlock;
  readonly preEntrenoHoy: HomeReporteHoyBlock;
  readonly postEntrenoHoy: HomeReporteHoyBlock;
}

function buildMetaMadrid(
  fechaCivilMadrid: string,
  extras: { readonly showDomingoPesoVentana: boolean; readonly usuarioAutenticado: boolean },
): HomeDashboardMeta {
  const fechaCivilMadridLegible = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(new Date(`${fechaCivilMadrid}T12:00:00.000Z`));
  return {
    fechaCivilMadrid,
    fechaCivilMadridLegible,
    showDomingoPesoVentana: extras.showDomingoPesoVentana,
    usuarioAutenticado: extras.usuarioAutenticado,
  };
}

/**
 * Agrega lecturas paralelas para la portada (sin datos simulados).
 */
export async function fetchHomeDashboard(): Promise<HomeDashboardPayload> {
  const fechaCivilMadrid = todayMadridIso();
  const desde7d = addDaysIsoUtc(fechaCivilMadrid, -6);
  const diaDb = diaSemanaDbFromMadridIso(fechaCivilMadrid);
  const showDomingoPesoVentana =
    isSundayEuropeMadrid(fechaCivilMadrid) && currentHourEuropeMadrid() < 14;

  const [
    bio,
    telem,
    reps,
    mem,
    ses,
    planIa,
    cnt7d,
    rutinaList,
    preHoy,
    postHoy,
    weeklyObjective,
    authLoggedIn,
  ] = await Promise.all([
    fetchBiometriaMaestro(),
    fetchLatestTelemetriaDiaria(),
    listReportesHtmlRecent({ limit: 5 }),
    listMemoriaIaRecent({ limit: 8 }),
    fetchUltimaSesionEntreno(),
    fetchDiarioPlanIa({ fecha: fechaCivilMadrid }),
    countEntrenosSessionDateGte(desde7d),
    fetchRutinaOficial(),
    fetchReporteHtmlByFechaYTipo({ fecha: fechaCivilMadrid, tipo: "PRE_ENTRENO" }),
    fetchReporteHtmlByFechaYTipo({ fecha: fechaCivilMadrid, tipo: "POST_ENTRENO" }),
    fetchWeeklyObjectiveHome(fechaCivilMadrid),
    (async (): Promise<boolean> => {
      const c = await createSupabaseServerClient();
      if (c === null) {
        return false;
      }
      const { data } = await c.auth.getUser();
      return data.user !== null;
    })(),
  ]);

  const meta = buildMetaMadrid(fechaCivilMadrid, {
    showDomingoPesoVentana,
    usuarioAutenticado: authLoggedIn,
  });

  const biometria: HomeDataBlock<BiometriaMaestroRow> =
    bio.ok === false
      ? { state: "error", message: bio.message }
      : bio.row === null || bio.row === undefined
        ? { state: "empty" }
        : { state: "ok", data: bio.row };

  const telemetriaLatest: HomeTelemetriaLatestBlock =
    telem.ok === false
      ? { state: "error", message: telem.message }
      : telem.uiQuerySkipped === true
        ? { state: "disabled" }
        : telem.row === null
          ? { state: "empty" }
          : { state: "ok", data: telem.row };

  const reportes: HomeDataBlock<readonly ReporteHtmlRow[]> =
    reps.ok === false
      ? { state: "error", message: reps.message }
      : reps.rows.length === 0
        ? { state: "empty" }
        : { state: "ok", data: reps.rows };

  const memoriaLines: HomeDataBlock<readonly MemoriaIaRow[]> =
    mem.ok === false
      ? { state: "error", message: mem.message }
      : mem.rows.length === 0
        ? { state: "empty" }
        : { state: "ok", data: mem.rows };

  const ultimaSesion: HomeDataBlock<EntrenoSessionPeek> =
    ses.ok === false
      ? { state: "error", message: ses.message }
      : ses.row === null || ses.row === undefined
        ? { state: "empty" }
        : { state: "ok", data: ses.row };

  const diarioPlanHoy: HomeDiarioPlanHoyBlock =
    planIa.ok === false
      ? { state: "error", message: planIa.message }
      : planIa.row === null
        ? { state: "no_plan" }
        : { state: "ok", data: planIa.row };

  const entrenos7dCount: HomeEntrenos7dCountBlock =
    cnt7d.ok === false ? { state: "error", message: cnt7d.message } : { state: "ok", count: cnt7d.count };

  const rutinaHoy: HomeRutinaHoyBlock = ((): HomeRutinaHoyBlock => {
    if (!rutinaList.ok) {
      return { state: "error", message: rutinaList.message };
    }
    const hit = rutinaList.rows.find((r) => r.dia === diaDb);
    if (hit === undefined) {
      return { state: "empty" };
    }
    return { state: "ok", data: hit };
  })();

  const preEntrenoHoy: HomeReporteHoyBlock = preHoy.ok
    ? preHoy.row === null
      ? { state: "empty" }
      : { state: "ok", data: preHoy.row }
    : { state: "error", message: preHoy.message };

  const postEntrenoHoy: HomeReporteHoyBlock = postHoy.ok
    ? postHoy.row === null
      ? { state: "empty" }
      : { state: "ok", data: postHoy.row }
    : { state: "error", message: postHoy.message };

  return {
    meta,
    weeklyObjective,
    biometria,
    telemetriaLatest,
    reportes,
    memoriaLines,
    ultimaSesion,
    diarioPlanHoy,
    entrenos7dCount,
    rutinaHoy,
    preEntrenoHoy,
    postEntrenoHoy,
  };
}
