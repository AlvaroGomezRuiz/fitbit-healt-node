import "server-only";

import { z } from "zod";

import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const objetivoNutricionTipoSchema = z.enum([
  "CUTTING_AGRESIVO",
  "CUTTING_SUAVE",
  "MANTENIMIENTO",
  "VOLUMEN_LIMPIO",
  "VOLUMEN_AGRESIVO",
]);

export const biometriaMaestroRowSchema = z.object({
  id: z.literal("singleton"),
  nombre: z.string(),
  fecha_nacimiento: z.string(),
  edad_anos: z.number(),
  sexo: z.enum(["M", "F"]),
  altura_cm: z.number(),
  peso_kg: z.number(),
  fecha_ultimo_pesaje: z.string(),
  imc: z.number(),
  body_fat_estimado_pct: z.number(),
  masa_libre_grasa_kg: z.number(),
  tendencia_peso_7dias_kg: z.number(),
  objetivo_tipo: objetivoNutricionTipoSchema,
  kcal_target: z.number(),
  proteina_g: z.number(),
  grasa_g: z.number(),
  carbos_g: z.number(),
  creatina_g: z.number(),
  agua_l: z.number(),
  fecha_ultimo_recalculo: z.string(),
  hrv_baseline_7d: z.number().nullable(),
  peso_baseline_2sem: z.number().nullable(),
  ultimo_top_set_squat: z.number().nullable(),
  ultimo_top_set_press: z.number().nullable(),
  bandera_roja: z.boolean(),
  motivo_bandera_roja: z.string().nullable(),
  ultimo_chequeo: z.string(),
  memoria_corta_7dias: z.record(z.unknown()),
  drive_file_id: z.string().nullable(),
  updated_at: z.string(),
});

export type BiometriaMaestroRow = z.infer<typeof biometriaMaestroRowSchema>;

export type FetchBiometriaMaestroResult =
  | { readonly ok: true; readonly row: BiometriaMaestroRow }
  | { readonly ok: true; readonly row: null }
  | {
      readonly ok: false;
      readonly code: "missing_env" | "query_error" | "row_shape";
      readonly message: string;
    };

const biometriaSelect =
  "id,nombre,fecha_nacimiento,edad_anos,sexo,altura_cm,peso_kg,fecha_ultimo_pesaje,imc,body_fat_estimado_pct,masa_libre_grasa_kg,tendencia_peso_7dias_kg,objetivo_tipo,kcal_target,proteina_g,grasa_g,carbos_g,creatina_g,agua_l,fecha_ultimo_recalculo,hrv_baseline_7d,peso_baseline_2sem,ultimo_top_set_squat,ultimo_top_set_press,bandera_roja,motivo_bandera_roja,ultimo_chequeo,memoria_corta_7dias,drive_file_id,updated_at" as const;

/**
 * Lee la fila única `biometria_maestro` (singleton).
 * Con RLS y JWT anon sin política SELECT, PostgREST suele devolver 0 filas sin error: entonces `row: null`
 * no distingue “no hay datos” de “hay datos pero no visibles”. La migración
 * `anon_select_biometria_maestro_singleton` alinea el comportamiento con `telemetria_diaria` (lectura portada/nutrición).
 */
export async function fetchBiometriaMaestro(): Promise<FetchBiometriaMaestroResult> {
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
    const { data, error } = await supabase.from("biometria_maestro").select(biometriaSelect).maybeSingle();
    if (error !== null) {
      return { ok: false, code: "query_error", message: publicSupabaseQueryFailureMessage(error.message) };
    }
    if (data === null) {
      return { ok: true, row: null };
    }
    const parsed = biometriaMaestroRowSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, code: "row_shape", message: "Formato inesperado en biometria_maestro." };
    }
    return { ok: true, row: parsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer biometría.";
    return { ok: false, code: "query_error", message };
  }
}
