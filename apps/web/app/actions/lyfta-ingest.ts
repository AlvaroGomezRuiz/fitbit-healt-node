"use server";

import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import type { LyftaIngestState, LyftaStructuredPreview } from "@/lib/actions/lyfta-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ingestInputSchema = z.object({
  rawText: z.string().trim().min(1, "Pega al menos una línea de Lyfta.").max(200_000),
});

function normalizeLyftaText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function extractSessionDate(lines: readonly string[]): string {
  const isoLike = /\b(20\d{2}-\d{2}-\d{2})\b/;
  for (const line of lines) {
    const m = isoLike.exec(line);
    if (m?.[1] !== undefined) {
      return m[1];
    }
  }
  return new Date().toISOString().slice(0, 10);
}

function buildStructured(rawText: string): LyftaStructuredPreview {
  const normalized = normalizeLyftaText(rawText);
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  const sessionTitle = lines[0]?.trim() ?? "Sesión Lyfta";
  const sessionDate = extractSessionDate(lines);
  const rowFingerprint = createHash("sha256").update(normalized, "utf8").digest("hex");
  return {
    sessionTitle,
    sessionDate,
    lineCount: lines.length,
    rowFingerprint,
  };
}

/**
 * Acepta texto pegado de Lyfta, devuelve vista estructurada e intenta insertar en `entrenos_historico`.
 */
export async function ingestLyftaAction(
  _prev: LyftaIngestState,
  formData: FormData,
): Promise<LyftaIngestState> {
  const raw = formData.get("rawText");
  const parsedInput = ingestInputSchema.safeParse({
    rawText: typeof raw === "string" ? raw : "",
  });
  if (!parsedInput.success) {
    const first = parsedInput.error.issues[0];
    return { status: "error", message: first?.message ?? "Entrada inválida." };
  }
  const rawText = parsedInput.data.rawText;
  const structured = buildStructured(rawText);
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      status: "stub",
      message:
        "Sin variables NEXT_PUBLIC_SUPABASE_* en apps/web: se muestra solo la vista previa (sin guardar).",
      structured,
    };
  }
  const normalized = normalizeLyftaText(rawText);
  try {
    const { data, error } = await supabase
      .from("entrenos_historico")
      .insert({
        origen: "lyfta_raw",
        drive_file_id: null,
        row_fingerprint: structured.rowFingerprint,
        session_date: structured.sessionDate,
        session_title: structured.sessionTitle,
        duration_text: "",
        exercise: "",
        set_type: "",
        weight_raw: "",
        weight_kg: null,
        reps: "",
        raw_payload: {
          source: "web_paste",
          text_preview: normalized.slice(0, 4000),
        },
      })
      .select("id")
      .single();
    if (error !== null) {
      return {
        status: "stub",
        message: `No se pudo guardar (RLS o duplicado): ${error.message}`,
        structured,
      };
    }
    const id = data !== null && typeof data === "object" && "id" in data ? String(data.id) : "";
    if (id === "") {
      return {
        status: "stub",
        message: "La inserción no devolvió id; comprobar políticas RLS o duplicados de fingerprint.",
        structured,
      };
    }
    return {
      status: "success",
      message: "Fila guardada en entrenos_historico (origen lyfta_raw).",
      structured,
      insertedId: id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido al insertar.";
    return {
      status: "stub",
      message: msg,
      structured,
    };
  }
}
