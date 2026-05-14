import "server-only";

import { listNutritionBannedItems } from "@/lib/data/nutrition-banned-item";
import { fetchBiometriaMaestro } from "@/lib/data/biometria-maestro";
import { fetchDiarioPlanIa } from "@/lib/data/diario-plan-ia";
import { mondayOfWeekMadridIso, todayMadridIso } from "@/lib/data/date-madrid";
import { listMemoriaIaShoppingCandidates } from "@/lib/data/memoria-ia";
import { fetchNutritionMenuWeek, type NutritionMenuWeekRow } from "@/lib/data/nutrition-menu-week";
import { listNutritionMemoryNotesRecent } from "@/lib/data/nutrition-memory-note";
import { fetchNutritionShoppingWeek, type NutritionShoppingWeekRow } from "@/lib/data/nutrition-shopping-week";
import { fetchNutritionWeekMondaysRecent } from "@/lib/data/nutrition-week-history";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { BiometriaMaestroRow } from "@/lib/data/biometria-maestro";
import type { DiarioPlanIaRow } from "@/lib/data/diario-plan-ia";
import type { MemoriaIaRow } from "@/lib/data/memoria-ia";
import type { NutritionBannedItemRow, NutritionMemoryNoteRow } from "@/lib/schemas/nutrition-week";

export type NutritionDayBlock<T> =
  | { readonly state: "ok"; readonly data: T }
  | { readonly state: "empty" }
  | { readonly state: "error"; readonly message: string };

export interface NutritionDayPayload {
  readonly fecha: string;
  /** Fecha civil actual en Madrid (para cortar el menú semanal al día de hoy). */
  readonly todayMadridIso: string;
  /** Lunes civil Madrid de la semana que contiene `fecha`. */
  readonly semanaInicioMadrid: string;
  readonly usuarioAutenticado: boolean;
  readonly biometria: NutritionDayBlock<BiometriaMaestroRow>;
  readonly shoppingLines: NutritionDayBlock<readonly MemoriaIaRow[]>;
  readonly diarioPlanIa: NutritionDayBlock<DiarioPlanIaRow>;
  readonly nutritionShoppingWeek: NutritionDayBlock<NutritionShoppingWeekRow>;
  readonly nutritionMenuWeek: NutritionDayBlock<NutritionMenuWeekRow>;
  readonly nutritionMemoryNotes: NutritionDayBlock<readonly NutritionMemoryNoteRow[]>;
  readonly nutritionBannedItems: NutritionDayBlock<readonly NutritionBannedItemRow[]>;
  readonly nutritionWeekHistory: NutritionDayBlock<readonly string[]>;
}

/**
 * Datos de nutrición para una fecha concreta (`YYYY-MM-DD`).
 */
export async function fetchNutritionDay(params: { readonly fecha: string }): Promise<NutritionDayPayload> {
  const hoyMadrid = todayMadridIso();
  const semanaInicioMadrid = mondayOfWeekMadridIso(params.fecha);

  const [
    bio,
    shop,
    planIa,
    shopWeek,
    menuWeek,
    memNotes,
    banned,
    weekHist,
    authLoggedIn,
  ] = await Promise.all([
    fetchBiometriaMaestro(),
    listMemoriaIaShoppingCandidates({ scanLimit: 120, maxMatches: 24 }),
    fetchDiarioPlanIa({ fecha: params.fecha }),
    fetchNutritionShoppingWeek(semanaInicioMadrid),
    fetchNutritionMenuWeek(semanaInicioMadrid),
    listNutritionMemoryNotesRecent({ limit: 40 }),
    listNutritionBannedItems(),
    fetchNutritionWeekMondaysRecent({ limit: 16 }),
    (async (): Promise<boolean> => {
      const c = await createSupabaseServerClient();
      if (c === null) {
        return false;
      }
      const { data } = await c.auth.getUser();
      return data.user !== null;
    })(),
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

  const nutritionShoppingWeek: NutritionDayBlock<NutritionShoppingWeekRow> =
    shopWeek.ok === false
      ? { state: "error", message: shopWeek.message }
      : shopWeek.row === null
        ? { state: "empty" }
        : { state: "ok", data: shopWeek.row };

  const nutritionMenuWeek: NutritionDayBlock<NutritionMenuWeekRow> =
    menuWeek.ok === false
      ? { state: "error", message: menuWeek.message }
      : menuWeek.row === null
        ? { state: "empty" }
        : { state: "ok", data: menuWeek.row };

  const nutritionMemoryNotes: NutritionDayBlock<readonly NutritionMemoryNoteRow[]> =
    memNotes.ok === false
      ? { state: "error", message: memNotes.message }
      : memNotes.rows.length === 0
        ? { state: "empty" }
        : { state: "ok", data: memNotes.rows };

  const nutritionBannedItems: NutritionDayBlock<readonly NutritionBannedItemRow[]> =
    banned.ok === false
      ? { state: "error", message: banned.message }
      : banned.rows.length === 0
        ? { state: "empty" }
        : { state: "ok", data: banned.rows };

  const nutritionWeekHistory: NutritionDayBlock<readonly string[]> =
    weekHist.ok === false
      ? { state: "error", message: weekHist.message }
      : weekHist.mondays.length === 0
        ? { state: "empty" }
        : { state: "ok", data: weekHist.mondays };

  return {
    fecha: params.fecha,
    todayMadridIso: hoyMadrid,
    semanaInicioMadrid,
    usuarioAutenticado: authLoggedIn,
    biometria,
    shoppingLines,
    diarioPlanIa,
    nutritionShoppingWeek,
    nutritionMenuWeek,
    nutritionMemoryNotes,
    nutritionBannedItems,
    nutritionWeekHistory,
  };
}
