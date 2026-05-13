import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

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

const diaSemanaDbSchema = z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

const grupoMuscularRutinaSchema = z.enum(["PUSH", "PULL", "LEG", "DESCANSO"]);

export const rutinaOficialDiaDetailSchema = z.object({
  dia: diaSemanaDbSchema,
  nombre_dia: z.string(),
  grupo_sesion: grupoMuscularRutinaSchema,
  hidratacion_gym: z.string().nullable(),
  ejercicios_markdown: z.string(),
});

export type RutinaOficialDiaDetail = z.infer<typeof rutinaOficialDiaDetailSchema>;

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

/**
 * Fila completa de `rutina_oficial` para un día enum (cron / servidor con `service_role`).
 */
export async function fetchRutinaOficialDetailByDia(params: {
  readonly supabase: SupabaseClient;
  readonly dia: DiaSemanaDb;
}): Promise<
  | { readonly ok: true; readonly row: RutinaOficialDiaDetail }
  | { readonly ok: true; readonly row: null }
  | { readonly ok: false; readonly code: "query_error" | "row_shape"; readonly message: string }
> {
  try {
    const { data, error } = await params.supabase
      .from("rutina_oficial")
      .select("dia,nombre_dia,grupo_sesion,hidratacion_gym,ejercicios_markdown")
      .eq("dia", params.dia)
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
    const parsed = rutinaOficialDiaDetailSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, code: "row_shape", message: "Formato de fila inesperado en rutina_oficial." };
    }
    return { ok: true, row: parsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer rutina.";
    return { ok: false, code: "query_error", message };
  }
}

function isRutinaRow(value: unknown): value is RutinaOficialRow {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const dia = Reflect.get(value, "dia");
  const nombre_dia = Reflect.get(value, "nombre_dia");
  const grupo_sesion = Reflect.get(value, "grupo_sesion");
  return (
    typeof dia === "string" &&
    typeof nombre_dia === "string" &&
    typeof grupo_sesion === "string"
  );
}
