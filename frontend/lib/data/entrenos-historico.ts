import "server-only";

import { z } from "zod";

import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const entrenoOrigenSchema = z.enum(["drive_csv", "lyfta_raw"]);

export const entrenoSessionPeekSchema = z.object({
  session_date: z.string(),
  session_title: z.string(),
  origen: entrenoOrigenSchema,
});

export type EntrenoSessionPeek = z.infer<typeof entrenoSessionPeekSchema>;

export type FetchUltimaSesionEntrenoResult =
  | { readonly ok: true; readonly row: EntrenoSessionPeek | null }
  | {
      readonly ok: false;
      readonly code: "missing_env" | "query_error" | "row_shape";
      readonly message: string;
    };

export type CountEntrenosDesdeFechaResult =
  | { readonly ok: true; readonly count: number }
  | {
      readonly ok: false;
      readonly code: "missing_env" | "bad_fecha" | "query_error";
      readonly message: string;
    };

const lyftaRawPayloadPeekSchema = z
  .object({
    text_preview: z.string().optional(),
  })
  .passthrough();

const entrenoHistoricoLyftaRowSchema = z.object({
  id: z.string().uuid(),
  origen: z.literal("lyfta_raw"),
  session_date: z.string(),
  session_title: z.string(),
  raw_payload: z.unknown(),
});

export type EntrenoHistoricoLyftaRow = z.infer<typeof entrenoHistoricoLyftaRowSchema>;

const entrenoHistoricoListRowSchema = z.object({
  id: z.string().uuid(),
  origen: entrenoOrigenSchema,
  session_date: z.string(),
  session_title: z.string(),
  raw_payload: z.unknown().nullable(),
});

export type EntrenoHistoricoListRow = z.infer<typeof entrenoHistoricoListRowSchema>;

export function extractLyftaTextPreviewFromRawPayload(raw: unknown): string {
  const parsed = lyftaRawPayloadPeekSchema.safeParse(raw);
  if (!parsed.success) {
    return "";
  }
  const tp = parsed.data.text_preview;
  return typeof tp === "string" ? tp : "";
}

export type ListEntrenosHistoricoRecentResult =
  | { readonly ok: true; readonly rows: readonly EntrenoHistoricoListRow[] }
  | {
      readonly ok: false;
      readonly code: "missing_env" | "query_error" | "row_shape";
      readonly message: string;
    };

/**
 * Sesiones recientes en `entrenos_historico` (orden por `session_date` desc).
 * Con políticas anon actuales puede incluir Lyfta y filas migradas desde Drive.
 */
export async function listEntrenosHistoricoRecent(params: {
  readonly limit: number;
}): Promise<ListEntrenosHistoricoRecentResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend/.env.local.",
    };
  }
  const limitRaw = Number.isFinite(params.limit) ? params.limit : 18;
  const limit = Math.min(Math.max(Math.floor(limitRaw), 1), 20);
  try {
    const { data, error } = await supabase
      .from("entrenos_historico")
      .select("id,origen,session_date,session_title,raw_payload")
      .order("session_date", { ascending: false })
      .limit(limit);
    if (error !== null) {
      return { ok: false, code: "query_error", message: publicSupabaseQueryFailureMessage(error.message) };
    }
    const rows: EntrenoHistoricoListRow[] = [];
    for (const item of data ?? []) {
      const parsed = entrenoHistoricoListRowSchema.safeParse(item);
      if (!parsed.success) {
        return { ok: false, code: "row_shape", message: "Formato inesperado en entrenos_historico." };
      }
      rows.push(parsed.data);
    }
    return { ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al listar entrenos.";
    return { ok: false, code: "query_error", message };
  }
}

export function previewLineForEntrenoHistoricoRow(row: EntrenoHistoricoListRow): string {
  if (row.origen === "lyfta_raw") {
    const peek = extractLyftaTextPreviewFromRawPayload(row.raw_payload);
    return peek.length > 0 ? peek : row.session_title;
  }
  return row.session_title;
}

export type FetchEntrenoHistoricoByIdResult =
  | { readonly ok: true; readonly row: EntrenoHistoricoLyftaRow }
  | {
      readonly ok: false;
      readonly code: "missing_env" | "bad_id" | "not_found" | "query_error" | "row_shape";
      readonly message: string;
    };

/**
 * Carga una fila de `entrenos_historico` por id (RSC / helpers).
 * Con política anon `lyfta_raw` solo devuelve filas Lyfta visibles para anon.
 */
export async function fetchEntrenoHistoricoById(id: string): Promise<FetchEntrenoHistoricoByIdResult> {
  const idParsed = z.string().uuid().safeParse(id.trim());
  if (!idParsed.success) {
    return { ok: false, code: "bad_id", message: "Identificador de fila no es un UUID válido." };
  }
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend/.env.local.",
    };
  }
  try {
    const { data, error } = await supabase
      .from("entrenos_historico")
      .select("id,origen,session_date,session_title,raw_payload")
      .eq("id", idParsed.data)
      .maybeSingle();
    if (error !== null) {
      return { ok: false, code: "query_error", message: publicSupabaseQueryFailureMessage(error.message) };
    }
    if (data === null) {
      return {
        ok: false,
        code: "not_found",
        message: "No hay fila con ese id o no es visible con la clave actual (RLS).",
      };
    }
    const parsed = entrenoHistoricoLyftaRowSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        code: "row_shape",
        message: "Formato inesperado o origen distinto de lyfta_raw.",
      };
    }
    return { ok: true, row: parsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer entrenos.";
    return { ok: false, code: "query_error", message };
  }
}

/**
 * Cuenta filas en `entrenos_historico` con `session_date >= desdeIso` (inclusive), `YYYY-MM-DD`.
 */
export async function countEntrenosSessionDateGte(desdeIso: string): Promise<CountEntrenosDesdeFechaResult> {
  const fechaOk = /^\d{4}-\d{2}-\d{2}$/u.test(desdeIso);
  if (!fechaOk) {
    return { ok: false, code: "bad_fecha", message: "Fecha inválida (se espera YYYY-MM-DD)." };
  }
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend/.env.local.",
    };
  }
  try {
    const { count, error } = await supabase
      .from("entrenos_historico")
      .select("id", { count: "exact", head: true })
      .gte("session_date", desdeIso);
    if (error !== null) {
      return { ok: false, code: "query_error", message: publicSupabaseQueryFailureMessage(error.message) };
    }
    return { ok: true, count: typeof count === "number" ? count : 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al contar entrenos.";
    return { ok: false, code: "query_error", message };
  }
}

/**
 * Última fila de entreno por fecha de sesión (referencia rápida de actividad).
 */
export async function fetchUltimaSesionEntreno(): Promise<FetchUltimaSesionEntrenoResult> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend/.env.local.",
    };
  }
  try {
    const { data, error } = await supabase
      .from("entrenos_historico")
      .select("session_date,session_title,origen")
      .order("session_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error !== null) {
      return { ok: false, code: "query_error", message: publicSupabaseQueryFailureMessage(error.message) };
    }
    if (data === null) {
      return { ok: true, row: null };
    }
    const parsed = entrenoSessionPeekSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, code: "row_shape", message: "Formato inesperado en entrenos_historico." };
    }
    return { ok: true, row: parsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer entrenos.";
    return { ok: false, code: "query_error", message };
  }
}
