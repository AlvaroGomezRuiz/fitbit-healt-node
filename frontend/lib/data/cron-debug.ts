import "server-only";

import { z } from "zod";

import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reportRunKindSchema = z.enum(["PRE_ENTRENO", "POST_ENTRENO", "RESUMEN_NOCHE", "WEEKLY"]);
const reportRunStatusSchema = z.enum(["ok", "error"]);

export const reportRunRowSchema = z.object({
  id: z.string().uuid(),
  run_at: z.string(),
  report_kind: reportRunKindSchema,
  target_madrid_date: z.string().nullable(),
  semana_inicio: z.string().nullable(),
  model_used: z.string(),
  input_tokens: z.number().nullable(),
  output_tokens: z.number().nullable(),
  status: reportRunStatusSchema,
  error_message: z.string().nullable(),
  duration_ms: z.number().nullable(),
});

export type ReportRunRow = z.infer<typeof reportRunRowSchema>;

export type ListReportRunRecentResult =
  | { readonly ok: true; readonly rows: readonly ReportRunRow[] }
  | {
      readonly ok: false;
      readonly code: "missing_env" | "query_error" | "row_shape";
      readonly message: string;
    };

const reportRunSelect =
  "id,run_at,report_kind,target_madrid_date,semana_inicio,model_used,input_tokens,output_tokens,status,error_message,duration_ms" as const;

/**
 * Últimas filas `report_run` (trazas LLM de informes), más recientes primero.
 */
export async function listReportRunRecent(params: {
  readonly limit: number;
}): Promise<ListReportRunRecentResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend/.env.local.",
    };
  }
  const limit = Number.isFinite(params.limit) ? Math.min(Math.max(params.limit, 1), 50) : 20;
  try {
    const { data, error } = await supabase
      .from("report_run")
      .select(reportRunSelect)
      .order("run_at", { ascending: false })
      .limit(limit);
    if (error !== null) {
      return { ok: false, code: "query_error", message: publicSupabaseQueryFailureMessage(error.message) };
    }
    const rows: ReportRunRow[] = [];
    for (const item of data ?? []) {
      const parsed = reportRunRowSchema.safeParse(item);
      if (!parsed.success) {
        return { ok: false, code: "row_shape", message: "Formato inesperado en report_run." };
      }
      rows.push(parsed.data);
    }
    return { ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer report_run.";
    return { ok: false, code: "query_error", message };
  }
}

export const cronInvocationRowSchema = z.object({
  id: z.string().uuid(),
  route_path: z.string(),
  started_at: z.string(),
  http_status: z.number().nullable(),
  duration_ms: z.number().nullable(),
  error_summary: z.string().nullable(),
});

export type CronInvocationRow = z.infer<typeof cronInvocationRowSchema>;

export type ListCronInvocationRecentResult =
  | { readonly ok: true; readonly rows: readonly CronInvocationRow[] }
  | {
      readonly ok: false;
      readonly code: "missing_env" | "query_error" | "row_shape";
      readonly message: string;
    };

const cronInvocationSelect = "id,route_path,started_at,http_status,duration_ms,error_summary" as const;

/**
 * Últimas filas `cron_invocation` (auditoría HTTP de crons), más recientes primero.
 */
export async function listCronInvocationRecent(params: {
  readonly limit: number;
}): Promise<ListCronInvocationRecentResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend/.env.local.",
    };
  }
  const limit = Number.isFinite(params.limit) ? Math.min(Math.max(params.limit, 1), 50) : 20;
  try {
    const { data, error } = await supabase
      .from("cron_invocation")
      .select(cronInvocationSelect)
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error !== null) {
      return { ok: false, code: "query_error", message: publicSupabaseQueryFailureMessage(error.message) };
    }
    const rows: CronInvocationRow[] = [];
    for (const item of data ?? []) {
      const parsed = cronInvocationRowSchema.safeParse(item);
      if (!parsed.success) {
        return { ok: false, code: "row_shape", message: "Formato inesperado en cron_invocation." };
      }
      rows.push(parsed.data);
    }
    return { ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer cron_invocation.";
    return { ok: false, code: "query_error", message };
  }
}
