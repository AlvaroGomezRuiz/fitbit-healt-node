import "server-only";

import { z } from "zod";

import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const diarioPlanIaRowSchema = z.object({
  fecha: z.string(),
  markdown: z.string(),
  updated_at: z.string(),
});

export type DiarioPlanIaRow = z.infer<typeof diarioPlanIaRowSchema>;

export type FetchDiarioPlanIaResult =
  | { readonly ok: true; readonly row: DiarioPlanIaRow | null }
  | { readonly ok: false; readonly code: "missing_env" | "query_error" | "row_shape"; readonly message: string };

/**
 * Lee `public.diario_plan_ia` para una fecha civil `YYYY-MM-DD`.
 */
export async function fetchDiarioPlanIa(params: { readonly fecha: string }): Promise<FetchDiarioPlanIaResult> {
  const fechaOk = /^\d{4}-\d{2}-\d{2}$/u.test(params.fecha);
  if (!fechaOk) {
    return { ok: false, code: "query_error", message: "Fecha inválida (se espera YYYY-MM-DD)." };
  }
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en apps/web/.env.local.",
    };
  }
  try {
    const { data, error } = await supabase
      .from("diario_plan_ia")
      .select("fecha,markdown,updated_at")
      .eq("fecha", params.fecha)
      .maybeSingle();
    if (error !== null) {
      return { ok: false, code: "query_error", message: publicSupabaseQueryFailureMessage(error.message) };
    }
    if (data === null) {
      return { ok: true, row: null };
    }
    const parsed = diarioPlanIaRowSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, code: "row_shape", message: "Formato inesperado en diario_plan_ia." };
    }
    return { ok: true, row: parsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer diario_plan_ia.";
    return { ok: false, code: "query_error", message };
  }
}
