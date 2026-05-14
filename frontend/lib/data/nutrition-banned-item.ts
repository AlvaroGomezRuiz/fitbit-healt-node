import "server-only";

import { nutritionBannedItemRowSchema, type NutritionBannedItemRow } from "@/lib/schemas/nutrition-week";
import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ListNutritionBannedItemsResult =
  | { readonly ok: true; readonly rows: readonly NutritionBannedItemRow[] }
  | { readonly ok: false; readonly message: string };

export async function listNutritionBannedItems(): Promise<ListNutritionBannedItemsResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { ok: true, rows: [] };
  }
  try {
    const { data, error } = await supabase.from("nutrition_banned_item").select("id, label").order("label", { ascending: true });
    if (error !== null) {
      const msg = error.message.toLowerCase();
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        return { ok: true, rows: [] };
      }
      return { ok: false, message: publicSupabaseQueryFailureMessage(error.message) };
    }
    const rows: NutritionBannedItemRow[] = [];
    for (const row of data ?? []) {
      const p = nutritionBannedItemRowSchema.safeParse(row);
      if (p.success) {
        rows.push(p.data);
      }
    }
    return { ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer prohibidos.";
    return { ok: false, message: publicSupabaseQueryFailureMessage(message) };
  }
}
