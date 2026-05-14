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

export type ReporteHtmlTipo = z.infer<typeof reporteHtmlTipoSchema>;

export type FetchReporteHtmlByFechaYTipoResult =
  | { readonly ok: true; readonly row: ReporteHtmlRow | null }
  | { readonly ok: false; readonly message: string };

/**
 * Una fila `reportes_html` para fecha civil + tipo (p. ej. pre/post del día).
 */
export async function fetchReporteHtmlByFechaYTipo(params: {
  readonly fecha: string;
  readonly tipo: ReporteHtmlTipo;
}): Promise<FetchReporteHtmlByFechaYTipoResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend/.env.local.",
    };
  }
  try {
    const { data, error } = await supabase
      .from("reportes_html")
      .select(reportesSelect)
      .eq("fecha", params.fecha)
      .eq("tipo", params.tipo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error !== null) {
      return { ok: false, message: publicSupabaseQueryFailureMessage(error.message) };
    }
    if (data === null || data === undefined) {
      return { ok: true, row: null };
    }
    const parsed = reporteHtmlRowSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, message: "Formato inesperado en reportes_html." };
    }
    return { ok: true, row: parsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer reportes_html.";
    return { ok: false, message };
  }
}

/**
 * Últimos informes HTML de un tipo concreto (p. ej. POST_ENTRENO), fecha descendente.
 */
export async function listReportesHtmlByTipoRecent(params: {
  readonly tipo: ReporteHtmlTipo;
  readonly limit: number;
}): Promise<ListReportesHtmlRecentResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend/.env.local.",
    };
  }
  const limit = Number.isFinite(params.limit) ? Math.min(Math.max(params.limit, 1), 20) : 5;
  try {
    const { data, error } = await supabase
      .from("reportes_html")
      .select(reportesSelect)
      .eq("tipo", params.tipo)
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
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend/.env.local.",
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
