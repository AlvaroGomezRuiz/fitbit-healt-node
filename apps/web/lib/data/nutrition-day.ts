import "server-only";

import { fetchBiometriaMaestro } from "@/lib/data/biometria-maestro";
import { fetchDiarioPlanIa } from "@/lib/data/diario-plan-ia";
import { fetchTelemetriaDiariaByFecha } from "@/lib/data/telemetria-diaria";
import { listMemoriaIaShoppingCandidates } from "@/lib/data/memoria-ia";

import type { BiometriaMaestroRow } from "@/lib/data/biometria-maestro";
import type { DiarioPlanIaRow } from "@/lib/data/diario-plan-ia";
import type { MemoriaIaRow } from "@/lib/data/memoria-ia";
import type { TelemetriaDiariaRow } from "@/lib/data/telemetria-diaria";

export type NutritionDayBlock<T> =
  | { readonly state: "ok"; readonly data: T }
  | { readonly state: "empty" }
  | { readonly state: "error"; readonly message: string };

/** Telemetría en vista nutrición: rama `disabled` si la UI Fitbit no está habilitada por env. */
export type NutritionTelemetriaDayBlock =
  | { readonly state: "disabled" }
  | { readonly state: "ok"; readonly data: TelemetriaDiariaRow }
  | { readonly state: "empty" }
  | { readonly state: "error"; readonly message: string };

export interface NutritionDayPayload {
  readonly fecha: string;
  readonly biometria: NutritionDayBlock<BiometriaMaestroRow>;
  readonly telemetriaDia: NutritionTelemetriaDayBlock;
  readonly shoppingLines: NutritionDayBlock<readonly MemoriaIaRow[]>;
  readonly diarioPlanIa: NutritionDayBlock<DiarioPlanIaRow>;
}

/**
 * Datos de nutrición/telemetría para una fecha concreta (`YYYY-MM-DD`).
 */
export async function fetchNutritionDay(params: { readonly fecha: string }): Promise<NutritionDayPayload> {
  const [bio, telem, shop, planIa] = await Promise.all([
    fetchBiometriaMaestro(),
    fetchTelemetriaDiariaByFecha({ fecha: params.fecha }),
    listMemoriaIaShoppingCandidates({ scanLimit: 120, maxMatches: 24 }),
    fetchDiarioPlanIa({ fecha: params.fecha }),
  ]);

  const biometria: NutritionDayBlock<BiometriaMaestroRow> =
    bio.ok === false
      ? { state: "error", message: bio.message }
      : bio.row === null
        ? { state: "empty" }
        : { state: "ok", data: bio.row };

  const telemetriaDia: NutritionTelemetriaDayBlock =
    telem.ok === false
      ? { state: "error", message: telem.message }
      : telem.uiQuerySkipped === true
        ? { state: "disabled" }
        : telem.row === null
          ? { state: "empty" }
          : { state: "ok", data: telem.row };

  const shoppingLines: NutritionDayBlock<readonly MemoriaIaRow[]> =
    shop.ok === false
      ? { state: "error", message: shop.message }
      : shop.rows.length === 0
        ? { state: "empty" }
        : { state: "ok", data: shop.rows };

  const diarioPlanIa: NutritionDayBlock<DiarioPlanIaRow> =
    planIa.ok === false
      ? { state: "error", message: planIa.message }
      : planIa.row === null
        ? { state: "empty" }
        : { state: "ok", data: planIa.row };

  return {
    fecha: params.fecha,
    biometria,
    telemetriaDia,
    shoppingLines,
    diarioPlanIa,
  };
}
