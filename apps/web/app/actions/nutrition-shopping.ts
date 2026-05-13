"use server";

import "server-only";

import { z } from "zod";

import { runDeepSeekCascade } from "@/lib/ai/reexport";
import { buildSundayShoppingListSystemPrompt } from "@/lib/ai/nutrition-shopping-prompt";
import { getJsDayOfWeekMadrid } from "@/lib/data/date-madrid";
import { fetchBiometriaMaestro } from "@/lib/data/biometria-maestro";

const inputSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type NutritionSundayShoppingResult =
  | { readonly ok: true; readonly markdown: string }
  | { readonly ok: false; readonly message: string };

/**
 * Genera markdown con lista de compra para el lunes y menú semanal (solo invocar con fecha domingo Europe/Madrid).
 */
export async function generateNutritionSundayShoppingAction(
  raw: unknown,
): Promise<NutritionSundayShoppingResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? "Fecha inválida." };
  }
  const { fecha } = parsed.data;
  if (getJsDayOfWeekMadrid(fecha) !== 0) {
    return {
      ok: false,
      message: "Esta acción solo aplica a un domingo (calendario Europe/Madrid).",
    };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    return {
      ok: false,
      message:
        "Falta DEEPSEEK_API_KEY en el entorno de apps/web (p. ej. apps/web/.env.local). No se llama a la API.",
    };
  }

  const bio = await fetchBiometriaMaestro();
  if (bio.ok === false) {
    return { ok: false, message: bio.message };
  }
  if (bio.row === null) {
    return {
      ok: false,
      message:
        "No hay fila de biometría maestra visible. Configura datos en Supabase o permisos RLS antes de generar la lista.",
    };
  }

  const row = bio.row;
  const system = buildSundayShoppingListSystemPrompt({
    kcalTarget: row.kcal_target,
    proteinG: row.proteina_g,
    carbosG: row.carbos_g,
    grasaG: row.grasa_g,
    creatinaG: row.creatina_g,
    aguaL: row.agua_l,
  });

  const userMessage = [
    "Genera lista de compra para el lunes y menú variado semanal en familia.",
    "",
    `Contexto calendario: domingo civil ${fecha} (Europe/Madrid), compra orientada al lunes siguiente; usa esta fecha como ancla para variar respecto a otras semanas.`,
    `Nombre en maestro (tono opcional): ${row.nombre}.`,
  ].join("\n");

  try {
    const result = await runDeepSeekCascade({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
      temperature: 0.62,
      maxTokens: 3500,
      signal: undefined,
    });
    const markdown = result.text.trim();
    if (markdown.length === 0) {
      return { ok: false, message: "La API devolvió texto vacío; reintenta en unos segundos." };
    }
    return { ok: true, markdown };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al invocar DeepSeek.";
    return { ok: false, message };
  }
}
