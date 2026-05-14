import "server-only";

import { z } from "zod";

import {
  parseNutritionShoppingItemsJson,
  type NutritionShoppingItem,
} from "@/lib/schemas/nutrition-week";
import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const rowSchema = z.object({
  semana_inicio: z.string(),
  items: z.unknown(),
  updated_at: z.string(),
});

export interface NutritionShoppingWeekRow {
  readonly semanaInicio: string;
  readonly items: readonly NutritionShoppingItem[];
  readonly updatedAt: string;
}

export type FetchNutritionShoppingWeekResult =
  | { readonly ok: true; readonly row: NutritionShoppingWeekRow }
  | { readonly ok: true; readonly row: null }
  | { readonly ok: false; readonly message: string };

export async function fetchNutritionShoppingWeek(semanaInicio: string): Promise<FetchNutritionShoppingWeekResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { ok: true, row: null };
  }
  try {
    const { data, error } = await supabase
      .from("nutrition_shopping_week")
      .select("semana_inicio, items, updated_at")
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
      return { ok: false, message: "Formato inesperado en nutrition_shopping_week." };
    }
    const itemsParsed = parseNutritionShoppingItemsJson(parsedRow.data.items);
    if (!itemsParsed.success) {
      return { ok: false, message: "Lista de compra JSON no válida." };
    }
    return {
      ok: true,
      row: {
        semanaInicio: parsedRow.data.semana_inicio,
        items: itemsParsed.data,
        updatedAt: parsedRow.data.updated_at,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer compra semanal.";
    return { ok: false, message: publicSupabaseQueryFailureMessage(message) };
  }
}
