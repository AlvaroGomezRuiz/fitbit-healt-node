import "server-only";

import { fetchBiometriaMaestro } from "@/lib/data/biometria-maestro";
import { fetchUltimaSesionEntreno } from "@/lib/data/entrenos-historico";
import { listMemoriaIaRecent } from "@/lib/data/memoria-ia";
import { listReportesHtmlRecent } from "@/lib/data/reportes-html";
import { fetchLatestTelemetriaDiaria } from "@/lib/data/telemetria-diaria";

import type { BiometriaMaestroRow } from "@/lib/data/biometria-maestro";
import type { EntrenoSessionPeek } from "@/lib/data/entrenos-historico";
import type { MemoriaIaRow } from "@/lib/data/memoria-ia";
import type { ReporteHtmlRow } from "@/lib/data/reportes-html";
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

export interface HomeDashboardPayload {
  readonly biometria: HomeDataBlock<BiometriaMaestroRow>;
  readonly telemetriaLatest: HomeTelemetriaLatestBlock;
  readonly reportes: HomeDataBlock<readonly ReporteHtmlRow[]>;
  readonly memoriaLines: HomeDataBlock<readonly MemoriaIaRow[]>;
  readonly ultimaSesion: HomeDataBlock<EntrenoSessionPeek>;
}

/**
 * Agrega lecturas paralelas para la portada (sin datos simulados).
 */
export async function fetchHomeDashboard(): Promise<HomeDashboardPayload> {
  const [bio, telem, reps, mem, ses] = await Promise.all([
    fetchBiometriaMaestro(),
    fetchLatestTelemetriaDiaria(),
    listReportesHtmlRecent({ limit: 5 }),
    listMemoriaIaRecent({ limit: 8 }),
    fetchUltimaSesionEntreno(),
  ]);

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

  return {
    biometria,
    telemetriaLatest,
    reportes,
    memoriaLines,
    ultimaSesion,
  };
}
