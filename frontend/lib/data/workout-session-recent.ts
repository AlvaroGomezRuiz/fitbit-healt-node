import "server-only";

import { z } from "zod";

import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const rowSchema = z.object({
  id: z.string().uuid(),
  session_date: z.string(),
  grupo: z.string(),
  title: z.string(),
  created_at: z.string(),
});

export type WorkoutSessionListRow = z.infer<typeof rowSchema>;

export type ListWorkoutSessionsRecentResult =
  | { readonly ok: true; readonly rows: readonly WorkoutSessionListRow[] }
  | { readonly ok: false; readonly message: string };

export async function listWorkoutSessionsRecent(params: { readonly limit: number }): Promise<ListWorkoutSessionsRecentResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { ok: true, rows: [] };
  }
  const lim = Math.min(Math.max(params.limit, 1), 50);
  try {
    const { data, error } = await supabase
      .from("workout_session")
      .select("id, session_date, grupo, title, created_at")
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(lim);
    if (error !== null) {
      const msg = error.message.toLowerCase();
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        return { ok: true, rows: [] };
      }
      return { ok: false, message: publicSupabaseQueryFailureMessage(error.message) };
    }
    const rows: WorkoutSessionListRow[] = [];
    for (const row of data ?? []) {
      const p = rowSchema.safeParse(row);
      if (p.success) {
        rows.push(p.data);
      }
    }
    return { ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al listar sesiones estructuradas.";
    return { ok: false, message: publicSupabaseQueryFailureMessage(message) };
  }
}
