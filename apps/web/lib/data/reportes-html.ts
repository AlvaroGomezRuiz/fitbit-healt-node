import "server-only";

import { z } from "zod";

import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reporteHtmlTipoSchema = z.enum(["PRE_ENTRENO", "POST_ENTRENO", "RESUMEN_NOCHE"]);

export const reporteHtmlRowSchema = z.object({
  id: z.string().uuid(),
  fecha: z.string(),
  tipo: reporteHtmlTipoSchema,
  nombre_archivo: z.string(),
  drive_file_id: z.string().nullable(),
  html_content: z.string(),
  created_at: z.string(),
});

export type ReporteHtmlRow = z.infer<typeof reporteHtmlRowSchema>;

export type ListReportesHtmlRecentResult =
  | { readonly ok: true; readonly rows: readonly ReporteHtmlRow[] }
  | {
      readonly ok: false;
      readonly code: "missing_env" | "query_error" | "row_shape";
      readonly message: string;
    };

export const reportesHtmlSelectColumns =
  "id,fecha,tipo,nombre_archivo,drive_file_id,html_content,created_at" as const;

const reportesSelect = reportesHtmlSelectColumns;

/**
 * Últimos informes HTML por fecha descendente (máx. `limit`).
 */
export async function listReportesHtmlRecent(params: {
  readonly limit: number;
}): Promise<ListReportesHtmlRecentResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en apps/web/.env.local.",
    };
  }
  const limit = Number.isFinite(params.limit) ? Math.min(Math.max(params.limit, 1), 20) : 5;
  try {
    const { data, error } = await supabase
      .from("reportes_html")
      .select(reportesSelect)
      .order("fecha", { ascending: false })
      .limit(limit);
    if (error !== null) {
      return { ok: false, code: "query_error", message: publicSupabaseQueryFailureMessage(error.message) };
    }
    const rows: ReporteHtmlRow[] = [];
    for (const item of data ?? []) {
      const parsed = reporteHtmlRowSchema.safeParse(item);
      if (!parsed.success) {
        return { ok: false, code: "row_shape", message: "Formato inesperado en reportes_html." };
      }
      rows.push(parsed.data);
    }
    return { ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer reportes_html.";
    return { ok: false, code: "query_error", message };
  }
}
