/**
 * Texto de restricciones fijas (horario Europe/Madrid + alimentos excluidos) para prompts de dieta en español.
 */
export const NUTRITION_USER_CONSTRAINTS_ES = [
  "Zona horaria de referencia: Europe/Madrid.",
  "Desayuno: 9:30–10:00.",
  "Gimnasio; llegada a casa aproximadamente 12:30–13:00.",
  "Comida principal: aproximadamente 14:30.",
  "Estudio; merienda: aproximadamente 18:30.",
  "Cena: 21:00–21:30.",
  "Excluir siempre (el usuario no los consume): atún, bonito, lechuga, tomate, brócoli, huevo duro, huevo frito, huevo a la plancha, ensaladas frías, ensaladilla rusa, gazpacho, salmorejo, pan de hamburguesa, hígado, casquería en general.",
]
  .map((line) => `- ${line}`)
  .join("\n");

/**
 * Construye el prompt de sistema para generar un plan de comidas en español.
 *
 * Los números deben provenir de la fila vigente en `biometria_maestro` (columnas homónimas en snake_case en BD):
 * `kcal_target` → kcalTarget, `proteina_g` → proteinG, `carbos_g` → carbosG, `grasa_g` → grasaG,
 * `creatina_g` → creatinaG, `agua_l` → aguaL.
 */
export function buildNutritionDietSystemPrompt(params: {
  readonly kcalTarget: number;
  readonly proteinG: number;
  readonly carbosG: number;
  readonly grasaG: number;
  readonly creatinaG: number;
  readonly aguaL: number;
}): string {
  const macroBlock = [
    "Objetivos numéricos diarios (respeta estos rangos salvo indicación médica explícita en el mensaje del usuario):",
    `- Energía objetivo: ${params.kcalTarget} kcal/día.`,
    `- Proteína: ${params.proteinG} g/día.`,
    `- Carbohidratos: ${params.carbosG} g/día.`,
    `- Grasa: ${params.grasaG} g/día.`,
    `- Creatina (si aplica en el plan): ${params.creatinaG} g/día.`,
    `- Hidratación orientativa: ${params.aguaL} L/día de líquidos (ajusta según sudoración y clima).`,
  ].join("\n");

  return [
    "Eres un nutricionista deportivo. Genera planes de comidas en español de España, claros y prácticos.",
    "Respeta estrictamente el horario, las exclusiones y los objetivos de macros indicados abajo.",
    "No sugieras ni incluyas alimentos o preparaciones de la lista de exclusiones.",
    "",
    "Restricciones de horario y alimentos:",
    NUTRITION_USER_CONSTRAINTS_ES,
    "",
    macroBlock,
  ].join("\n");
}
