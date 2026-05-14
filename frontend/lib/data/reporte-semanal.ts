import "server-only";

import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

/** Fila alineada a `public.reporte_semanal` (DB-02). */
export const reporteSemanalRowSchema = z.object({
  semana_inicio: z.string(),
  html_content: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ReporteSemanalRow = z.infer<typeof reporteSemanalRowSchema>;

export const reporteSemanalSelectColumns = "semana_inicio,html_content,created_at,updated_at" as const;

export type ReporteSemanalBySemanaResult =
  | { readonly ok: true; readonly row: ReporteSemanalRow | null }
  | { readonly ok: false; readonly code: "missing_env" | "query_error" | "row_shape"; readonly message: string };

/**
 * Lee un informe semanal por lunes civil `YYYY-MM-DD` (PK `semana_inicio`).
 */
export async function readReporteSemanalBySemanaInicio(params: {
  readonly semanaInicioIso: string;
}): Promise<ReporteSemanalBySemanaResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend/.env.local.",
    };
  }
  const { data, error } = await supabase
    .from("reporte_semanal")
    .select(reporteSemanalSelectColumns)
    .eq("semana_inicio", params.semanaInicioIso)
    .maybeSingle();
  if (error !== null) {
    return {
      ok: false,
      code: "query_error",
      message: publicSupabaseQueryFailureMessage(error.message),
    };
  }
  if (data === null) {
    return { ok: true, row: null };
  }
  const parsed = reporteSemanalRowSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, code: "row_shape", message: "Formato inesperado en reporte_semanal." };
  }
  return { ok: true, row: parsed.data };
}
