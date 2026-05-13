/**
 * Extrae 1–2 líneas útiles de markdown para resúmenes en UI (sin render HTML).
 */
export function markdownPlainPreviewLines(source: string, maxChars: number): string {
  const n = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : 160;
  const cleaned = source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/u, "")
        .replace(/\*\*|__/gu, "")
        .replace(/`+/gu, "")
        .replace(/\[([^\u005d]+)\]\([^)]+\)/u, "$1")
        .trim(),
    )
    .filter((line) => line.length > 0);
  const joined = cleaned.slice(0, 2).join(" ");
  if (joined.length <= n) {
    return joined;
  }
  return `${joined.slice(0, n).trim()}…`;
}
