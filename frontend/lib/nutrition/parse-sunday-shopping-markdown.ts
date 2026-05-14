const WEEKDAY_HEADERS_ES: readonly string[] = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

export interface ParsedSundayShoppingMarkdown {
  /** Bloque bajo el encabezado de lista de compra (markdown en texto). */
  readonly shopping: string;
  /** Un panel por día de la semana (Lunes…Domingo). */
  readonly dayPanels: readonly { readonly day: string; readonly body: string }[];
  /** Secciones `##` no clasificadas (p. ej. formato antiguo o notas). */
  readonly remainder: string;
}

function isListaCompraTitle(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("lista") && t.includes("compra");
}

function matchWeekdayTitle(title: string): string | undefined {
  return WEEKDAY_HEADERS_ES.find(
    (d) =>
      title === d ||
      title.startsWith(`${d} `) ||
      title.startsWith(`${d}—`) ||
      title.startsWith(`${d}–`) ||
      title.startsWith(`${d} -`),
  );
}

/**
 * Parte el markdown generado por la IA: lista de compra + días (encabezados `##`).
 * Si no hay `##`, devuelve todo en `remainder` y el resto vacío.
 */
export function parseSundayShoppingMarkdown(markdown: string): ParsedSundayShoppingMarkdown {
  const trimmed = markdown.trim();
  if (trimmed.length === 0) {
    return { shopping: "", dayPanels: [], remainder: "" };
  }

  const lines = trimmed.split("\n");
  type Acc = { readonly title: string; readonly bodyLines: string[] };
  const blocks: Acc[] = [];

  let currentTitle: string | null = null;
  const currentBody: string[] = [];

  const pushBlock = (): void => {
    if (currentTitle === null) {
      return;
    }
    blocks.push({ title: currentTitle, bodyLines: [...currentBody] });
    currentBody.length = 0;
  };

  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading !== null) {
      pushBlock();
      const raw = heading[1];
      currentTitle = raw !== undefined ? raw.trim() : "";
    } else if (currentTitle !== null) {
      currentBody.push(line);
    }
  }
  pushBlock();

  if (blocks.length === 0) {
    return { shopping: "", dayPanels: [], remainder: trimmed };
  }

  let shopping = "";
  const dayPanels: { day: string; body: string }[] = [];
  const orphanBlocks: Acc[] = [];

  for (const block of blocks) {
    const body = block.bodyLines.join("\n").trim();
    if (isListaCompraTitle(block.title)) {
      shopping = shopping.length > 0 ? `${shopping}\n\n${body}` : body;
      continue;
    }
    const day = matchWeekdayTitle(block.title);
    if (day !== undefined) {
      dayPanels.push({ day, body });
      continue;
    }
    orphanBlocks.push(block);
  }

  const remainder = orphanBlocks
    .map((b) => `## ${b.title}\n${b.bodyLines.join("\n").trim()}`)
    .join("\n\n")
    .trim();

  return { shopping, dayPanels, remainder };
}
