import "server-only";

import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

const entrenoOrigenSchema = z.enum(["drive_csv", "lyfta_raw"]);

const entrenoHistoricoContextRowSchema = z.object({
  session_date: z.string(),
  session_title: z.string(),
  origen: entrenoOrigenSchema,
  exercise: z.string(),
});

type EntrenoHistoricoContextRow = z.infer<typeof entrenoHistoricoContextRowSchema>;

function clampText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 24))}\n…(truncado)`;
}

/**
 * Resume sesiones recientes en bullets compactos para prompts de IA (límite de tokens).
 * Agrupa por `session_date` (varias filas por sesión en la tabla).
 */
export async function buildEntrenosHistoricoContextForPrompt(params: {
  readonly supabase: SupabaseClient;
  readonly maxSessions: number;
  readonly maxChars: number;
}): Promise<string> {
  const maxSessions = Math.min(Math.max(params.maxSessions, 1), 14);
  const maxChars = Math.min(Math.max(params.maxChars, 200), 4000);
  const scanRows = Math.min(maxSessions * 25, 120);

  const { data, error } = await params.supabase
    .from("entrenos_historico")
    .select("session_date,session_title,origen,exercise")
    .order("session_date", { ascending: false })
    .limit(scanRows);

  if (error !== null) {
    return "Entrenos recientes: no disponible (error de lectura).";
  }
  if (data === null || data.length === 0) {
    return "Entrenos recientes: sin filas en entrenos_historico.";
  }

  const sessions = new Map<
    string,
    { readonly title: string; readonly origen: string; readonly exercises: string[] }
  >();

  for (const raw of data) {
    const parsed = entrenoHistoricoContextRowSchema.safeParse(raw);
    if (!parsed.success) {
      continue;
    }
    const row: EntrenoHistoricoContextRow = parsed.data;
    const existing = sessions.get(row.session_date);
    const ex = row.exercise.trim();
    if (existing === undefined) {
      if (sessions.size >= maxSessions) {
        continue;
      }
      sessions.set(row.session_date, {
        title: row.session_title.trim() || "—",
        origen: row.origen,
        exercises: ex.length > 0 ? [ex] : [],
      });
      continue;
    }
    if (existing.exercises.length < 4 && ex.length > 0 && !existing.exercises.includes(ex)) {
      sessions.set(row.session_date, {
        ...existing,
        exercises: [...existing.exercises, ex],
      });
    }
  }

  if (sessions.size === 0) {
    return "Entrenos recientes: sin filas válidas tras validación.";
  }

  const sortedDates = [...sessions.keys()].sort((a, b) => b.localeCompare(a));
  const bullets: string[] = [];
  for (const date of sortedDates) {
    const s = sessions.get(date);
    if (s === undefined) {
      continue;
    }
    const exSample =
      s.exercises.length === 0 ? "—" : s.exercises.slice(0, 3).join(", ");
    bullets.push(`- ${date} | ${s.origen} | ${s.title} | ej.: ${exSample}`);
  }

  const body = ["Entrenos recientes (compacto, por fecha de sesión):", ...bullets].join("\n");
  return clampText(body, maxChars);
}
