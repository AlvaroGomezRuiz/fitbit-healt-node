import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runDeepSeekCascade } from "@/lib/ai/reexport";
import { buildSundayShoppingListSystemPrompt, buildSundayShoppingListUserMessage } from "@/lib/ai/nutrition-shopping-prompt";
import type { BiometriaMaestroRow } from "@/lib/data/biometria-maestro";
import { mondayOfWeekMadridIso } from "@/lib/data/date-madrid";

export type SundayShoppingMarkdownResult =
  | { readonly ok: true; readonly markdown: string; readonly modelUsed: string; readonly attempts: number }
  | { readonly ok: false; readonly message: string };

export type PersistSundayShoppingResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * Invoca DeepSeek con el mismo contrato que la Server Action manual (lista + menú semanal).
 */
export async function generateSundayShoppingMarkdown(params: {
  readonly biometria: BiometriaMaestroRow;
  readonly fechaVista: string;
  readonly entrenosHistoricoCompact: string;
}): Promise<SundayShoppingMarkdownResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    return {
      ok: false,
      message:
        "Falta DEEPSEEK_API_KEY en el entorno de frontend (p. ej. frontend/.env.local). No se llama a la API.",
    };
  }

  const row = params.biometria;
  const system = buildSundayShoppingListSystemPrompt({
    kcalTarget: row.kcal_target,
    proteinG: row.proteina_g,
    carbosG: row.carbos_g,
    grasaG: row.grasa_g,
  });

  const userMessage = buildSundayShoppingListUserMessage({
    fecha: params.fechaVista,
    entrenosHistoricoCompact: params.entrenosHistoricoCompact,
  });

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
    return { ok: true, markdown, modelUsed: result.modelUsed, attempts: result.attempts };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al invocar DeepSeek.";
    return { ok: false, message };
  }
}

/**
 * Upsert en `memoria_ia`: una fila por semana (clave lunes Madrid + line_index 0) para que la heurística de compra la detecte.
 */
export async function persistSundayShoppingMarkdownToMemoriaIa(params: {
  readonly supabase: SupabaseClient;
  readonly markdown: string;
  readonly fechaVista: string;
}): Promise<PersistSundayShoppingResult> {
  const weekMondayIso = mondayOfWeekMadridIso(params.fechaVista);
  const driveFileId = `nutrition_sunday_ai_${weekMondayIso}`;
  const sourceFilename = `sunday_shopping_${weekMondayIso}.md`;
  const nowIso = new Date().toISOString();

  const { error } = await params.supabase.from("memoria_ia").upsert(
    {
      drive_file_id: driveFileId,
      source_filename: sourceFilename,
      line_index: 0,
      event_ts: nowIso,
      contenido_linea: params.markdown,
    },
    { onConflict: "drive_file_id,line_index" },
  );

  if (error !== null) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
