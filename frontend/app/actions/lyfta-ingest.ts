"use server";

import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import type { LyftaIngestState, LyftaStructuredPreview } from "@/lib/actions/lyfta-types";
import { revalidateAfterEntrenosHistoricoWrite } from "@/lib/cache/revalidate-after-data-write";
import {
  buildWorkoutSessionAutoTitle,
  buildWorkoutSetLineDraftsFromLyftaLines,
  detectGrupoMuscularFromLyftaText,
} from "@/lib/lyfta/workout-structured-ingest";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const ingestInputSchema = z.object({
  rawText: z.string().trim().min(1, "Pega al menos una línea de Lyfta.").max(200_000),
});

function normalizeLyftaText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

/** Fecha calendario local (YYYY-MM-DD), evita desfase UTC vs “hoy” del usuario. */
function defaultSessionDateLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function extractSessionDate(lines: readonly string[]): string {
  const isoLike = /\b(20\d{2}-\d{2}-\d{2})\b/;
  for (const line of lines) {
    const m = isoLike.exec(line);
    if (m?.[1] !== undefined) {
      return m[1];
    }
  }
  return defaultSessionDateLocalIso();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readPostgrestErrorParts(err: unknown): { readonly message: string; readonly code: string | undefined } {
  if (!isRecord(err)) {
    return { message: "error_desconocido", code: undefined };
  }
  const messageVal = err["message"];
  const codeVal = err["code"];
  return {
    message: typeof messageVal === "string" ? messageVal : "error_desconocido",
    code: typeof codeVal === "string" ? codeVal : undefined,
  };
}

function isLikelyRlsDenial(message: string, code: string | undefined): boolean {
  if (code === "42501") {
    return true;
  }
  const m = message.toLowerCase();
  return (
    m.includes("row-level security") ||
    m.includes("violates row-level security") ||
    m.includes("new row violates row-level security policy") ||
    (m.includes("permission denied") && m.includes("entrenos_historico"))
  );
}

function isLikelyUniqueFingerprint(message: string, code: string | undefined): boolean {
  if (code === "23505") {
    return true;
  }
  const m = message.toLowerCase();
  return m.includes("duplicate key") || m.includes("unique constraint");
}

function formatInsertFailure(params: {
  readonly err: unknown;
  readonly usedServiceRole: boolean;
}): string {
  const { message, code } = readPostgrestErrorParts(params.err);
  if (isLikelyUniqueFingerprint(message, code)) {
    return "No se pudo guardar: conflicto de unicidad (mismo contenido). Si persiste, recarga e inténtalo de nuevo.";
  }
  if (!params.usedServiceRole && isLikelyRlsDenial(message, code)) {
    return (
      "No se pudo guardar: el inserto fue denegado por RLS con la clave anónima/sesión. " +
      "Configura SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor de frontend (p. ej. frontend/.env.local, variables del proyecto en Vercel, o el .env de la raíz del repo; nunca NEXT_PUBLIC_* ni el bundle cliente) y reinicia el dev server. " +
      `Detalle técnico: ${message}`
    );
  }
  return `No se pudo guardar: ${message}`;
}

function buildStructured(rawText: string): LyftaStructuredPreview {
  const normalized = normalizeLyftaText(rawText);
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  const sessionDate = extractSessionDate(lines);
  const grupo = detectGrupoMuscularFromLyftaText(normalized);
  const sessionTitle = buildWorkoutSessionAutoTitle({ grupo, sessionDateIso: sessionDate });
  const rowFingerprint = createHash("sha256").update(normalized, "utf8").digest("hex");
  return {
    sessionTitle,
    sessionDate,
    grupo,
    lineCount: lines.length,
    rowFingerprint,
  };
}

function readInsertedRowId(data: unknown): string {
  if (!isRecord(data)) {
    return "";
  }
  const idVal = data["id"];
  return typeof idVal === "string" && idVal.length > 0 ? idVal : "";
}

function isMissingRelationError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find the table");
}

/**
 * Persiste sesión + líneas en DB-03. Devuelve `null` si todo bien; aviso corto si falla (sin tumbar el flujo plano).
 */
async function persistWorkoutSessionDb03(params: {
  readonly supabase: SupabaseClient;
  readonly normalized: string;
  readonly structured: LyftaStructuredPreview;
  readonly lineTexts: readonly string[];
}): Promise<string | null> {
  const { data, error } = await params.supabase
    .from("workout_session")
    .upsert(
      {
        session_date: params.structured.sessionDate,
        grupo: params.structured.grupo,
        title: params.structured.sessionTitle,
        raw_lyfta_text: params.normalized,
        source: "lyfta_paste",
        row_fingerprint: params.structured.rowFingerprint,
      },
      { onConflict: "source,row_fingerprint" },
    )
    .select("id")
    .maybeSingle();

  if (error !== null) {
    if (isMissingRelationError(error.message)) {
      return null;
    }
    return `no se guardó la sesión estructurada (workout_session): ${error.message}`;
  }
  if (data === null || !isRecord(data)) {
    return "workout_session no devolvió fila tras upsert.";
  }
  const sidVal = data["id"];
  const sessionId = typeof sidVal === "string" && sidVal.length > 0 ? sidVal : "";

  if (sessionId === "") {
    return "workout_session devolvió id vacío.";
  }

  const del = await params.supabase.from("workout_set_line").delete().eq("session_id", sessionId);
  if (del.error !== null && !isMissingRelationError(del.error.message)) {
    return `no se pudieron borrar series previas: ${del.error.message}`;
  }

  const drafts = buildWorkoutSetLineDraftsFromLyftaLines(params.lineTexts);
  if (drafts.length === 0) {
    return null;
  }

  const insertRows = drafts.map((d) => ({
    session_id: sessionId,
    line_order: d.lineOrder,
    exercise_name: d.exerciseName,
    set_type: d.setType,
    weight_kg: d.weightKg,
    reps: d.reps,
    rir: d.rir,
    raw_line: d.rawLine,
  }));

  const ins = await params.supabase.from("workout_set_line").insert(insertRows);
  if (ins.error !== null) {
    if (isMissingRelationError(ins.error.message)) {
      return null;
    }
    await params.supabase.from("workout_session").delete().eq("id", sessionId);
    return `no se insertaron líneas de serie (${ins.error.message}); la sesión estructurada se revirtió.`;
  }
  return null;
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
  /** Preferir service_role: bypass RLS; si falta la clave en el proceso de Next, cae a anon+cookies (sujeto a RLS). */
  const serviceClient = createSupabaseServiceRoleClient();
  const usedServiceRole = serviceClient !== null;
  const supabase = serviceClient ?? (await createSupabaseServerClient());
  if (supabase === null) {
    return {
      status: "stub",
      message:
        "Sin variables NEXT_PUBLIC_SUPABASE_* en frontend: se muestra solo la vista previa (sin guardar).",
      structured,
    };
  }
  const normalized = normalizeLyftaText(rawText);
  try {
    const { data, error } = await supabase
      .from("entrenos_historico")
      .upsert(
        {
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
        },
        { onConflict: "origen,row_fingerprint" },
      )
      .select("id")
      .single();
    if (error !== null) {
      return {
        status: "error",
        message: formatInsertFailure({ err: error, usedServiceRole }),
      };
    }
    const id = readInsertedRowId(data);
    if (id === "") {
      return {
        status: "error",
        message: "El guardado no devolvió id; revisa permisos RLS o la migración anon UPDATE para upsert Lyfta.",
      };
    }
    const lineTexts = normalized.split("\n").filter((l) => l.trim().length > 0);
    const db03Warning = await persistWorkoutSessionDb03({
      supabase,
      normalized,
      structured,
      lineTexts,
    });
    revalidateAfterEntrenosHistoricoWrite();
    const baseMessage =
      "Listo: guardado en historial plano y en sesión estructurada (migración DB-03). Mismo pegado = mismo fingerprint (sin duplicar).";
    const message =
      db03Warning !== null && db03Warning.length > 0 ? `${baseMessage}\nAviso: ${db03Warning}` : baseMessage;
    return {
      status: "success",
      message,
      structured,
      insertedId: id,
      textPreview: normalized.slice(0, 4000),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido al insertar.";
    return { status: "error", message: msg };
  }
}
