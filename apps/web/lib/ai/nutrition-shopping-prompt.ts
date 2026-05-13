import { NUTRITION_USER_CONSTRAINTS_ES } from "@/lib/ai/nutrition-diet-prompt";

/**
 * Prompt de sistema: lista de compra semanal + menú por días (Madrid).
 * El markdown usa encabezados `##` solo como contrato interno para el parser; la UI no muestra MD crudo.
 */
export function buildSundayShoppingListSystemPrompt(params: {
  readonly kcalTarget: number;
  readonly proteinG: number;
  readonly carbosG: number;
  readonly grasaG: number;
}): string {
  const macroBlock = [
    "Objetivos diarios (cantidades y reparto en comidas deben respetarlos):",
    `- Energía: ${params.kcalTarget} kcal/día.`,
    `- Proteína: ${params.proteinG} g/día.`,
    `- Carbohidratos: ${params.carbosG} g/día.`,
    `- Grasa: ${params.grasaG} g/día.`,
  ].join("\n");

  return [
    "Eres nutricionista práctico en España. El usuario hace compra semanal y cocina en familia; ingredientes realistas de súper medio; variedad razonable respecto a semanas anteriores si se indica fecha de ancla.",
    "Salida: español de España, markdown.",
    "Prohibido en la salida: saludos, despedidas, emojis, narrativa tipo blog, tono familiar/coloquial, mencionar el nombre del usuario, frases como «aquí tienes» o «espero que».",
    "Sin HTML. Sin tablas salvo imprescindible (prefiere listas).",
    "",
    "Estructura obligatoria: encabezados de nivel 2 exactamente en este orden (línea que empiece por `## `):",
    "## Lista de compra",
    "Debajo: solo viñetas (`- `). Agrupa por zonas del súper (fruta/verdura, frescos, despensa, congelados si aplica). Cada ítem con cantidad explícita (g, kg o unidades). Sin prosa entre bloques.",
    "## Lunes",
    "## Martes",
    "## Miércoles",
    "## Jueves",
    "## Viernes",
    "## Sábado",
    "## Domingo",
    "En cada día: 3–6 líneas máximo. Formato por línea (ejemplo de forma, adapta alimentos reales):",
    "`200 g pollo · 200 g arroz · 15 g aceite · ~aprox 650 kcal · P 45 g / C 60 g / G 18 g`",
    "Incluye aporte aproximado (kcal y P/C/G) al menos en una línea-resumen por comida principal si encaja; si no hay datos fiables, omite números pero mantén cantidades de alimentos.",
    "Plato principal distinto entre días consecutivos cuando sea posible.",
    "",
    "Restricciones (cumplimiento estricto; no sugerir ni comprar excluidos):",
    NUTRITION_USER_CONSTRAINTS_ES,
    "",
    macroBlock,
  ].join("\n");
}

/**
 * Mensaje usuario para generación de lista + menú (fecha de vista Madrid y entrenos opcional).
 */
export function buildSundayShoppingListUserMessage(params: {
  readonly fecha: string;
  readonly entrenosHistoricoCompact: string;
}): string {
  const lines = [
    "Genera la lista de compra de la semana y el menú por días según el contrato del sistema.",
    "",
    `Fecha ancla (Europe/Madrid): ${params.fecha}. Úsala para variar respecto a otras semanas; no la menciones en la salida.`,
  ];
  const compact = params.entrenosHistoricoCompact.trim();
  if (compact.length > 0) {
    lines.push("", "=== Entrenos recientes (compacto) ===", compact);
  }
  return lines.join("\n");
}
