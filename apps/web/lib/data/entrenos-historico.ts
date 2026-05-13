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
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en apps/web/.env.local.",
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
