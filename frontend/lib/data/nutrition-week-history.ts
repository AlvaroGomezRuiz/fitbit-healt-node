import "server-only";

import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Lunes recientes que tienen fila en compra o menú (historial de semanas).
 */
export async function fetchNutritionWeekMondaysRecent(params: {
  readonly limit: number;
}): Promise<{ readonly ok: true; readonly mondays: readonly string[] } | { readonly ok: false; readonly message: string }> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { ok: true, mondays: [] };
  }
  const lim = Math.min(Math.max(params.limit, 1), 52);
  try {
    const [shopRes, menuRes] = await Promise.all([
      supabase.from("nutrition_shopping_week").select("semana_inicio").order("semana_inicio", { ascending: false }).limit(lim),
      supabase.from("nutrition_menu_week").select("semana_inicio").order("semana_inicio", { ascending: false }).limit(lim),
    ]);
    if (shopRes.error !== null) {
      const msg = shopRes.error.message.toLowerCase();
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        return { ok: true, mondays: [] };
      }
      return { ok: false, message: publicSupabaseQueryFailureMessage(shopRes.error.message) };
    }
    if (menuRes.error !== null) {
      const msg = menuRes.error.message.toLowerCase();
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        return { ok: true, mondays: [] };
      }
      return { ok: false, message: publicSupabaseQueryFailureMessage(menuRes.error.message) };
    }
    const set = new Set<string>();
    for (const row of shopRes.data ?? []) {
      if (row !== null && typeof row === "object" && "semana_inicio" in row) {
        const v = row["semana_inicio"];
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
          set.add(v);
        }
      }
    }
    for (const row of menuRes.data ?? []) {
      if (row !== null && typeof row === "object" && "semana_inicio" in row) {
        const v = row["semana_inicio"];
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
          set.add(v);
        }
      }
    }
    const mondays = Array.from(set).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, lim);
    return { ok: true, mondays };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al listar semanas de nutrición.";
    return { ok: false, message: publicSupabaseQueryFailureMessage(message) };
  }
}
