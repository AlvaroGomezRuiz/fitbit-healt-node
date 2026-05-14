import "server-only";

import { nutritionMemoryNoteRowSchema, type NutritionMemoryNoteRow } from "@/lib/schemas/nutrition-week";
import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ListNutritionMemoryNotesResult =
  | { readonly ok: true; readonly rows: readonly NutritionMemoryNoteRow[] }
  | { readonly ok: false; readonly message: string };

export async function listNutritionMemoryNotesRecent(params: {
  readonly limit: number;
}): Promise<ListNutritionMemoryNotesResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { ok: true, rows: [] };
  }
  const lim = Math.min(Math.max(params.limit, 1), 100);
  try {
    const { data, error } = await supabase
      .from("nutrition_memory_note")
      .select("id, created_at, content, pinned")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(lim);
    if (error !== null) {
      const msg = error.message.toLowerCase();
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        return { ok: true, rows: [] };
      }
      return { ok: false, message: publicSupabaseQueryFailureMessage(error.message) };
    }
    const rows: NutritionMemoryNoteRow[] = [];
    for (const row of data ?? []) {
      const p = nutritionMemoryNoteRowSchema.safeParse(row);
      if (p.success) {
        rows.push(p.data);
      }
    }
    return { ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer notas de memoria.";
    return { ok: false, message: publicSupabaseQueryFailureMessage(message) };
  }
}
