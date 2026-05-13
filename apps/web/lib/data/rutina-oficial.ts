import "server-only";

import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DiaSemanaDb =
  | "MON"
  | "TUE"
  | "WED"
  | "THU"
  | "FRI"
  | "SAT"
  | "SUN";

export interface RutinaOficialRow {
  readonly dia: DiaSemanaDb;
  readonly nombre_dia: string;
  readonly grupo_sesion: string;
}

export type RutinaOficialFetchResult =
  | { readonly ok: true; readonly rows: readonly RutinaOficialRow[] }
  | { readonly ok: false; readonly code: "missing_env" | "query_error"; readonly message: string };

/**
 * Lee la tabla pequeña `rutina_oficial` (máx. 7 filas). Requiere políticas RLS que permitan anon o sesión.
 */
export async function fetchRutinaOficial(): Promise<RutinaOficialFetchResult> {
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
      .from("rutina_oficial")
      .select("dia,nombre_dia,grupo_sesion")
      .order("dia", { ascending: true });
    if (error !== null) {
      return {
        ok: false,
        code: "query_error",
        message: publicSupabaseQueryFailureMessage(error.message),
      };
    }
    const rows: RutinaOficialRow[] = (data ?? []).map((row: unknown) => {
      if (!isRutinaRow(row)) {
        throw new Error("Formato de fila inesperado desde Supabase.");
      }
      return row;
    });
    return { ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer rutina.";
    return { ok: false, code: "query_error", message };
  }
}

function isRutinaRow(value: unknown): value is RutinaOficialRow {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.dia === "string" &&
    typeof rec.nombre_dia === "string" &&
    typeof rec.grupo_sesion === "string"
  );
}
