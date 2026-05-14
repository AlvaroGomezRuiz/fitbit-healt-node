import "server-only";

import { z } from "zod";

import { parseNutritionMenuDaysJson, type NutritionMenuWeekDays } from "@/lib/schemas/nutrition-week";
import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const rowSchema = z.object({
  semana_inicio: z.string(),
  days: z.unknown(),
  updated_at: z.string(),
});

export interface NutritionMenuWeekRow {
  readonly semanaInicio: string;
  readonly days: NutritionMenuWeekDays;
  readonly updatedAt: string;
}

export type FetchNutritionMenuWeekResult =
  | { readonly ok: true; readonly row: NutritionMenuWeekRow }
  | { readonly ok: true; readonly row: null }
  | { readonly ok: false; readonly message: string };

export async function fetchNutritionMenuWeek(semanaInicio: string): Promise<FetchNutritionMenuWeekResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { ok: true, row: null };
  }
  try {
    const { data, error } = await supabase
      .from("nutrition_menu_week")
      .select("semana_inicio, days, updated_at")
      .eq("semana_inicio", semanaInicio)
      .maybeSingle();
    if (error !== null) {
      const msg = error.message.toLowerCase();
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        return { ok: true, row: null };
      }
      return { ok: false, message: publicSupabaseQueryFailureMessage(error.message) };
    }
    if (data === null) {
      return { ok: true, row: null };
    }
    const parsedRow = rowSchema.safeParse(data);
    if (!parsedRow.success) {
      return { ok: false, message: "Formato inesperado en nutrition_menu_week." };
    }
    const daysParsed = parseNutritionMenuDaysJson(parsedRow.data.days);
    if (!daysParsed.success) {
      return { ok: false, message: "Menú semanal JSON no válido." };
    }
    return {
      ok: true,
      row: {
        semanaInicio: parsedRow.data.semana_inicio,
        days: daysParsed.data,
        updatedAt: parsedRow.data.updated_at,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer menú semanal.";
    return { ok: false, message: publicSupabaseQueryFailureMessage(message) };
  }
}
