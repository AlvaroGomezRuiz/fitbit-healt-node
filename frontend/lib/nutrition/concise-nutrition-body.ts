/**
 * Convierte cuerpos markdown/texto de nutrición (lista o menú) en listas concisas o prosa truncada.
 */

export type ConciseNutritionBodyViewModel =
  | { readonly kind: "list"; readonly items: readonly string[] }
  | { readonly kind: "prose"; readonly text: string; readonly showPromptHint: boolean };

const GREETING_LINE = /^\s*¡?\s*hola\b/i;
const BULLET_PREFIX = /^[-*•]\s+(.+)$/;
/** Línea tipo comida con cantidades o aporte calórico. */
const STRUCTURED_LINE =
  /(\d+[.,]?\d*\s*(g|kg|ml|mL|l|L)\b)|(\d+[.,]?\d*\s*kcal\b)|·|(\bP\s*[/\s]\s*C\s*[/\s]\s*G\b)|(\bPFC\b)/i;

function stripGreetingLines(lines: readonly string[]): readonly string[] {
  return lines.filter((line) => !GREETING_LINE.test(line.trim()));
}

function normalizeLines(body: string): readonly string[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== "---");
}

function lineToItem(line: string): string | undefined {
  const bullet = BULLET_PREFIX.exec(line);
  if (bullet !== null && bullet[1] !== undefined) {
    return bullet[1].trim();
  }
  if (STRUCTURED_LINE.test(line)) {
    return line.trim();
  }
  return undefined;
}

/**
 * Decide entre lista (`<ul>`) y párrafo truncado según heurística de viñetas / cantidades.
 */
export function bodyToConciseNutritionViewModel(body: string): ConciseNutritionBodyViewModel {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { kind: "list", items: [] };
  }
  const rawLines = normalizeLines(trimmed);
  const lines = stripGreetingLines(rawLines);
  const items: string[] = [];
  for (const line of lines) {
    const item = lineToItem(line);
    if (item !== undefined) {
      items.push(item);
    }
  }
  if (items.length >= 1) {
    return { kind: "list", items };
  }
  const flattened = lines.join(" ").replace(/\s+/g, " ").trim();
  const max = 320;
  const text = flattened.length > max ? `${flattened.slice(0, max)}…` : flattened;
  return { kind: "prose", text, showPromptHint: flattened.length > 0 };
}
