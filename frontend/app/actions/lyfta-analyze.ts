"use server";

import "server-only";

import { z } from "zod";

import type { LyftaAnalyzeState } from "@/lib/actions/lyfta-ai-state";
import { extractLyftaTextPreviewFromRawPayload } from "@/lib/data/entrenos-historico";
import { runDeepSeekCascade } from "@/lib/ai/reexport";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const analyzeInputSchema = z.object({
  entrenoHistoricoId: z.string().uuid(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

const rowShapeSchema = z.object({
  id: z.string().uuid(),
  origen: z.enum(["drive_csv", "lyfta_raw"]),
  session_title: z.string(),
  session_date: z.string(),
  raw_payload: z.unknown(),
});

/**
 * Carga `entrenos_historico` por id (service_role si existe, si no cliente servidor) y pide un resumen breve en español.
 */
export async function analyzeLyftaSessionAction(
  _prev: LyftaAnalyzeState,
  formData: FormData,
): Promise<LyftaAnalyzeState> {
  void _prev;
  const rawId = formData.get("entrenoHistoricoId");
  const parsedInput = analyzeInputSchema.safeParse({
    entrenoHistoricoId: typeof rawId === "string" ? rawId : "",
  });
  if (!parsedInput.success) {
    const first = parsedInput.error.issues[0];
    return { status: "error", message: first?.message ?? "Identificador inválido." };
  }
  const entrenoHistoricoId = parsedInput.data.entrenoHistoricoId;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    return {
      status: "error",
      message:
        "Falta DEEPSEEK_API_KEY en el entorno de frontend (p. ej. frontend/.env.local). No se llama a la API.",
    };
  }

  const serviceClient = createSupabaseServiceRoleClient();
  const supabase = serviceClient ?? (await createSupabaseServerClient());
  if (supabase === null) {
    return {
      status: "error",
      message:
        "Sin cliente Supabase: configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend.",
    };
  }

  const { data, error } = await supabase
    .from("entrenos_historico")
    .select("id,origen,session_title,session_date,raw_payload")
    .eq("id", entrenoHistoricoId)
    .maybeSingle();

  if (error !== null) {
    return { status: "error", message: `No se pudo leer el entreno: ${error.message}` };
  }
  if (data === null) {
    return {
      status: "error",
      message: "No se encontró la fila o no tienes permiso de lectura (revisa RLS y migración anon SELECT lyfta).",
    };
  }

  const rowParsed = rowShapeSchema.safeParse(data);
  if (!rowParsed.success) {
    return { status: "error", message: "Respuesta de Supabase con formato inesperado." };
  }
  const row = rowParsed.data;
  if (row.origen !== "lyfta_raw") {
    return { status: "error", message: "Solo se pueden resumir sesiones con origen lyfta_raw." };
  }

  const preview = extractLyftaTextPreviewFromRawPayload(row.raw_payload);
  const bodyText =
    preview.trim().length > 0
      ? preview
      : typeof row.raw_payload === "string"
        ? row.raw_payload
        : isRecord(row.raw_payload)
          ? JSON.stringify(row.raw_payload).slice(0, 8000)
          : "";

  if (bodyText.trim().length === 0) {
    return {
      status: "error",
      message: "La fila no contiene texto utilizable en raw_payload; vuelve a guardar el pegado desde Lyfta.",
    };
  }

  const userBlock = [
    `Metadatos: título="${row.session_title}", fecha_sesión=${row.session_date}, id=${row.id}.`,
    "Contenido (recorte almacenado):",
    bodyText,
  ].join("\n");

  try {
    const result = await runDeepSeekCascade({
      messages: [
        {
          role: "system",
          content:
            "Eres un entrenador asistente. Resume en español el entreno de forma breve (2–5 frases): foco muscular, ejercicios o bloques destacados, volumen aproximado si se deduce, y una sola recomendación práctica si aplica. No inventes datos que no aparezcan en el texto.",
        },
        { role: "user", content: userBlock },
      ],
      temperature: 0.25,
      maxTokens: 1200,
      signal: undefined,
    });
    return { status: "success", reply: result.text.trim() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al invocar DeepSeek.";
    return { status: "error", message };
  }
}
