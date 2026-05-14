/**
 * Extrae texto legible desde HTML (sin renderizar markup en el cliente).
 */
export function textPreviewFromHtml(html: string, maxLen: number): string {
  const len = Number.isFinite(maxLen) && maxLen > 8 ? Math.floor(maxLen) : 160;
  const noTags = html.replace(/<[^>]+>/g, " ");
  const collapsed = noTags.replace(/\s+/g, " ").trim();
  if (collapsed.length <= len) {
    return collapsed;
  }
  return `${collapsed.slice(0, len)}…`;
}
