"use server";

import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import type { LyftaIngestState, LyftaStructuredPreview } from "@/lib/actions/lyfta-types";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

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

/**
 * Evita usar la primera línea (suele ser un ejercicio): intenta cabeceras tipo Título/Title/Workout
 * y, si no hay coincidencia, usa `Sesión YYYY-MM-DD` con la fecha detectada en el bloque.
 */
function extractSessionTitle(lines: readonly string[], sessionDateIso: string): string {
  const headerPatterns: readonly RegExp[] = [
    /^(?:título|titulo|title|nombre\s+de\s+sesión|workout|session)\s*[:：]\s*(.+)$/iu,
  ];
  const scanLimit = Math.min(lines.length, 30);
  for (let i = 0; i < scanLimit; i += 1) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }
    const t = line.trim();
    if (t.length === 0) {
      continue;
    }
    for (const re of headerPatterns) {
      const m = re.exec(t);
      const cap = m?.[1]?.trim();
      if (cap !== undefined && cap.length > 0) {
        return cap.length > 200 ? `${cap.slice(0, 197)}…` : cap;
      }
    }
  }
  return `Sesión ${sessionDateIso}`;
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
      "Configura SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor de apps/web (p. ej. apps/web/.env.local, variables del proyecto en Vercel, o el .env de la raíz del repo; nunca NEXT_PUBLIC_* ni el bundle cliente) y reinicia el dev server. " +
      `Detalle técnico: ${message}`
    );
  }
  return `No se pudo guardar: ${message}`;
}

function buildStructured(rawText: string): LyftaStructuredPreview {
  const normalized = normalizeLyftaText(rawText);
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  const sessionDate = extractSessionDate(lines);
  const sessionTitle = extractSessionTitle(lines, sessionDate);
  const rowFingerprint = createHash("sha256").update(normalized, "utf8").digest("hex");
  return {
    sessionTitle,
    sessionDate,
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
        "Sin variables NEXT_PUBLIC_SUPABASE_* en apps/web: se muestra solo la vista previa (sin guardar).",
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
        status: "stub",
        message: formatInsertFailure({ err: error, usedServiceRole }),
        structured,
      };
    }
    const id = readInsertedRowId(data);
    if (id === "") {
      return {
        status: "stub",
        message: "El guardado no devolvió id; revisa permisos RLS o la migración anon UPDATE para upsert Lyfta.",
        structured,
      };
    }
    return {
      status: "success",
      message:
        "Listo: sesión guardada en el historial. Si pegaste el mismo texto otra vez, se actualizó el mismo registro (sin duplicar).",
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
