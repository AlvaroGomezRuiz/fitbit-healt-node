import "server-only";

import { fetchBiometriaMaestro } from "@/lib/data/biometria-maestro";
import { fetchDiarioPlanIa } from "@/lib/data/diario-plan-ia";
import { todayMadridIso } from "@/lib/data/date-madrid";
import { listMemoriaIaShoppingCandidates } from "@/lib/data/memoria-ia";

import type { BiometriaMaestroRow } from "@/lib/data/biometria-maestro";
import type { DiarioPlanIaRow } from "@/lib/data/diario-plan-ia";
import type { MemoriaIaRow } from "@/lib/data/memoria-ia";

export type NutritionDayBlock<T> =
  | { readonly state: "ok"; readonly data: T }
  | { readonly state: "empty" }
  | { readonly state: "error"; readonly message: string };

export interface NutritionDayPayload {
  readonly fecha: string;
  /** Fecha civil actual en Madrid (para cortar el menú semanal al día de hoy). */
  readonly todayMadridIso: string;
  readonly biometria: NutritionDayBlock<BiometriaMaestroRow>;
  readonly shoppingLines: NutritionDayBlock<readonly MemoriaIaRow[]>;
  readonly diarioPlanIa: NutritionDayBlock<DiarioPlanIaRow>;
}

/**
 * Datos de nutrición para una fecha concreta (`YYYY-MM-DD`).
 */
export async function fetchNutritionDay(params: { readonly fecha: string }): Promise<NutritionDayPayload> {
  const hoyMadrid = todayMadridIso();
  const [bio, shop, planIa] = await Promise.all([
    fetchBiometriaMaestro(),
    listMemoriaIaShoppingCandidates({ scanLimit: 120, maxMatches: 24 }),
    fetchDiarioPlanIa({ fecha: params.fecha }),
  ]);

  const biometria: NutritionDayBlock<BiometriaMaestroRow> =
    bio.ok === false
      ? { state: "error", message: bio.message }
      : bio.row === null
        ? { state: "empty" }
        : { state: "ok", data: bio.row };

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
    todayMadridIso: hoyMadrid,
    biometria,
    shoppingLines,
    diarioPlanIa,
  };
}
