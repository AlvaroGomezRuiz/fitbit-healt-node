/**
 * Formateo seguro de líneas `memoria_ia` para portada (solo texto, sin HTML).
 */

const DEFAULT_MAX_CHARS = 220;

function squeezeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateWithEllipsis(value: string, maxChars: number): string {
  const n = Number.isFinite(maxChars) && maxChars > 12 ? Math.floor(maxChars) : DEFAULT_MAX_CHARS;
  const t = squeezeWhitespace(value);
  if (t.length <= n) {
    return t;
  }
  return `${t.slice(0, n).trim()}…`;
}

/**
 * Acorta nombres de archivo técnicos para cabecera de tarjeta.
 */
export function shortMemoriaSourceFilename(filename: string): string {
  const noPath = filename.replace(/^.*[/\\]/u, "");
  return noPath.replace(/\.[^.]+$/u, "") || noPath;
}

/**
 * Quita prefijos repetitivos (slugs, ids) y trunca prosa larga.
 */
export function formatMemoriaIaLinePreview(raw: string, maxChars?: number): string {
  const limit = maxChars ?? DEFAULT_MAX_CHARS;
  let s = raw.replace(/\r\n/g, "\n").trim();
  const slugTail = /^[a-z0-9_.-]{4,}\s*(?:›|>|\|)\s*(.+)$/iu.exec(s);
  if (slugTail?.[1] !== undefined) {
    s = slugTail[1].trim();
  }
  s = s.replace(/^[a-z0-9_-]{8,}\s*[:|]\s*/iu, "");
  return truncateWithEllipsis(s, limit);
}

function normalizeForDedupe(value: string): string {
  return squeezeWhitespace(value).toLowerCase();
}

export interface MemoriaLineDisplayInput {
  readonly id: string;
  readonly source_filename: string;
  readonly contenido_linea: string;
}

export interface MemoriaLineDisplayEntry {
  readonly id: string;
  readonly sourceShort: string;
  readonly line: string;
}

/**
 * Formatea líneas y elimina duplicados consecutivos (mismo texto tras normalizar).
 */
export function buildMemoriaDisplayEntries(
  rows: readonly MemoriaLineDisplayInput[],
  maxChars?: number,
): readonly MemoriaLineDisplayEntry[] {
  const out: MemoriaLineDisplayEntry[] = [];
  let prevNorm = "";
  for (const row of rows) {
    const line = formatMemoriaIaLinePreview(row.contenido_linea, maxChars);
    const norm = normalizeForDedupe(line);
    if (norm.length === 0) {
      continue;
    }
    if (norm === prevNorm) {
      continue;
    }
    prevNorm = norm;
    out.push({
      id: row.id,
      sourceShort: shortMemoriaSourceFilename(row.source_filename),
      line,
    });
  }
  return out;
}
