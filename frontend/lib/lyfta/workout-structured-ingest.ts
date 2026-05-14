/**
 * Normalización mínima para dedupe y persistencia DB-03 (sin dependencias externas).
 */

export type GrupoMuscularRutinaDb = "PUSH" | "PULL" | "LEG" | "DESCANSO";

export interface WorkoutSetLineDraft {
  readonly lineOrder: number;
  readonly rawLine: string;
  readonly exerciseName: string;
  readonly setType: string;
  readonly weightKg: number | null;
  readonly reps: string;
  readonly rir: number | null;
}

const GRUPO_RE = /\b(PULL|PUSH|LEG)\b/i;

/**
 * Detecta PULL / PUSH / LEG en las primeras líneas del pegado; si no hay coincidencia, DESCANSO.
 */
export function detectGrupoMuscularFromLyftaText(normalizedText: string): GrupoMuscularRutinaDb {
  const head = normalizedText.slice(0, 800);
  const m = GRUPO_RE.exec(head);
  if (m?.[1] === undefined) {
    return "DESCANSO";
  }
  const u = m[1].toUpperCase();
  if (u === "PULL" || u === "PUSH" || u === "LEG") {
    return u;
  }
  return "DESCANSO";
}

/**
 * Título producto: `PULL 2026-05-13` (grupo + fecha civil sesión, Madrid en ingest vía caller).
 */
export function buildWorkoutSessionAutoTitle(params: {
  readonly grupo: GrupoMuscularRutinaDb;
  readonly sessionDateIso: string;
}): string {
  const t = `${params.grupo} ${params.sessionDateIso}`;
  return t.length > 200 ? `${t.slice(0, 197)}…` : t;
}

function trimLine(s: string): string {
  return s.trim();
}

function extractExerciseName(raw: string): string {
  const t = trimLine(raw);
  if (t.length === 0) {
    return "";
  }
  const at = /^@\s*([^:@]+?)(?:\s*[:@]|$)/i.exec(t);
  if (at?.[1] !== undefined) {
    const name = at[1].trim();
    return name.length > 200 ? `${name.slice(0, 197)}…` : name;
  }
  const beforeKg = /^(.+?)\s+(?:\d+[.,]?\d*\s*(?:kg|KG)|@)/u.exec(t);
  if (beforeKg?.[1] !== undefined) {
    const name = beforeKg[1].replace(/^[-•*]\s*/, "").trim();
    if (name.length > 0) {
      return name.length > 200 ? `${name.slice(0, 197)}…` : name;
    }
  }
  const firstToken = t.split(/\s+/u)[0];
  if (firstToken !== undefined && firstToken.length > 1 && !/^\d/u.test(firstToken)) {
    return firstToken.length > 200 ? `${firstToken.slice(0, 197)}…` : firstToken;
  }
  return "";
}

function extractWeightKg(raw: string): number | null {
  const m = /(\d+[.,]?\d*)\s*(?:kg|KG)\b/u.exec(raw);
  if (m?.[1] === undefined) {
    return null;
  }
  const n = Number.parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function extractReps(raw: string): string {
  const m = /(?:x|×)\s*(\d+(?:\s*\+\s*\d+)?)\b/i.exec(raw);
  if (m?.[1] !== undefined) {
    return m[1].length > 80 ? `${m[1].slice(0, 77)}…` : m[1];
  }
  const m2 = /\b(\d{1,3})\s*(?:reps?|REP)\b/i.exec(raw);
  if (m2?.[1] !== undefined) {
    return m2[1];
  }
  return "";
}

function extractRir(raw: string): number | null {
  const m = /\b(?:RIR|rir)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\b/u.exec(raw);
  if (m?.[1] === undefined) {
    return null;
  }
  const n = Number.parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.round(n * 10) / 10;
}

/**
 * Convierte líneas no vacías en borradores para `workout_set_line`.
 */
export function buildWorkoutSetLineDraftsFromLyftaLines(lines: readonly string[]): readonly WorkoutSetLineDraft[] {
  const out: WorkoutSetLineDraft[] = [];
  let order = 0;
  for (const line of lines) {
    const rawLine = trimLine(line);
    if (rawLine.length === 0) {
      continue;
    }
    out.push({
      lineOrder: order,
      rawLine: rawLine.length > 4000 ? `${rawLine.slice(0, 3997)}…` : rawLine,
      exerciseName: extractExerciseName(rawLine),
      setType: "",
      weightKg: extractWeightKg(rawLine),
      reps: extractReps(rawLine),
      rir: extractRir(rawLine),
    });
    order += 1;
  }
  return out;
}
