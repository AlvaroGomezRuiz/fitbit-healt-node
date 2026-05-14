"use server";

import "server-only";

import { z } from "zod";

import { currentHourEuropeMadrid, isSundayEuropeMadrid, todayMadridIso } from "@/lib/data/date-madrid";
import { revalidateAfterBiometriaMaestroWrite } from "@/lib/cache/revalidate-after-data-write";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const domingoPesoFormSchema = z.object({
  pesoKg: z
    .string()
    .trim()
    .min(1, "Indica el peso en kg.")
    .transform((s) => Number.parseFloat(s.replace(",", ".")))
    .refine((n) => Number.isFinite(n), "Peso no numérico.")
    .refine((n) => n >= 40, "Peso demasiado bajo.")
    .refine((n) => n <= 220, "Peso demasiado alto."),
});

export type DomingoPesoAyunasFormState =
  | { readonly kind: "idle" }
  | { readonly kind: "success"; readonly pesoKg: number; readonly fechaPesaje: string }
  | { readonly kind: "error"; readonly message: string };

function computeImcKgM2(pesoKg: number, alturaCm: number): number {
  const m = alturaCm / 100;
  if (m <= 0) {
    return 0;
  }
  return Math.round((pesoKg / (m * m)) * 10) / 10;
}

/**
 * Registra peso ayunas del domingo en `biometria_maestro` (singleton). Requiere sesión y ventana domingo mañana Madrid.
 */
export async function submitDomingoPesoAyunas(
  _prev: DomingoPesoAyunasFormState,
  formData: FormData,
): Promise<DomingoPesoAyunasFormState> {
  const hoyMadrid = todayMadridIso();
  if (!isSundayEuropeMadrid(hoyMadrid) || currentHourEuropeMadrid() >= 14) {
    return { kind: "error", message: "Fuera de ventana: solo domingos antes de las 14:00 (hora Madrid)." };
  }

  const rawPeso = formData.get("peso_kg");
  const parsed = domingoPesoFormSchema.safeParse({
    pesoKg: typeof rawPeso === "string" ? rawPeso : "",
  });
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors.pesoKg?.[0];
    return { kind: "error", message: typeof first === "string" ? first : "Datos de peso no válidos." };
  }
  const pesoKg = parsed.data.pesoKg;

  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { kind: "error", message: "Faltan variables Supabase en el servidor." };
  }
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user === null) {
    return { kind: "error", message: "Inicia sesión para guardar el peso dominical." };
  }

  const { data: row, error: readErr } = await supabase
    .from("biometria_maestro")
    .select("altura_cm")
    .eq("id", "singleton")
    .maybeSingle();
  if (readErr !== null) {
    return { kind: "error", message: readErr.message };
  }
  if (row === null || typeof row !== "object") {
    return { kind: "error", message: "No hay fila de biometría para actualizar." };
  }
  const alturaRaw = "altura_cm" in row ? row["altura_cm"] : undefined;
  const alturaCm = typeof alturaRaw === "number" ? alturaRaw : Number.NaN;
  if (!Number.isFinite(alturaCm) || alturaCm <= 0) {
    return { kind: "error", message: "Altura en biometría no válida; revisa la fila singleton." };
  }

  const imc = computeImcKgM2(pesoKg, alturaCm);
  const nowIso = new Date().toISOString();

  const { error: writeErr } = await supabase
    .from("biometria_maestro")
    .update({
      peso_kg: pesoKg,
      fecha_ultimo_pesaje: hoyMadrid,
      imc,
      updated_at: nowIso,
    })
    .eq("id", "singleton");

  if (writeErr !== null) {
    return { kind: "error", message: writeErr.message };
  }

  revalidateAfterBiometriaMaestroWrite();
  return { kind: "success", pesoKg, fechaPesaje: hoyMadrid };
}
