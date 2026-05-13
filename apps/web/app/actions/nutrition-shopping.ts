"use server";

import "server-only";

import { z } from "zod";

import { fetchBiometriaMaestro } from "@/lib/data/biometria-maestro";
import { buildEntrenosHistoricoContextForPrompt } from "@/lib/data/build-entrenos-historico-context";
import {
  generateSundayShoppingMarkdown,
  persistSundayShoppingMarkdownToMemoriaIa,
} from "@/lib/nutrition/sunday-shopping-generation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type NutritionSundayShoppingResult =
  | { readonly ok: true; readonly markdown: string }
  | { readonly ok: false; readonly message: string };

/**
 * Genera markdown con lista de compra (lunes) y menú semanal; con `SUPABASE_SERVICE_ROLE_KEY` persiste en `memoria_ia`
 * (misma fila semanal que el cron domingo).
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

  const svc = createSupabaseServiceRoleClient();
  const entrenosHistoricoCompact =
    svc === null
      ? ""
      : await buildEntrenosHistoricoContextForPrompt({
          supabase: svc,
          maxSessions: 10,
          maxChars: 2000,
        });

  const gen = await generateSundayShoppingMarkdown({
    biometria: bio.row,
    fechaVista: fecha,
    entrenosHistoricoCompact,
  });
  if (gen.ok === false) {
    return gen;
  }

  if (svc !== null) {
    const persist = await persistSundayShoppingMarkdownToMemoriaIa({
      supabase: svc,
      markdown: gen.markdown,
      fechaVista: fecha,
    });
    if (persist.ok === false) {
      return {
        ok: false,
        message: `La IA generó texto pero no se pudo guardar en memoria_ia: ${persist.message}`,
      };
    }
  }

  return { ok: true, markdown: gen.markdown };
}
