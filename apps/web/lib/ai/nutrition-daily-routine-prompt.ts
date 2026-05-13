import type { RutinaOficialDiaDetail } from "@/lib/data/rutina-oficial";
import type { TelemetriaDiariaRow } from "@/lib/data/telemetria-diaria";

import { buildNutritionDietSystemPrompt } from "@/lib/ai/nutrition-diet-prompt";

const DAILY_ROUTINE_INSTRUCTION_ES = [
  "Genera el plan solo para la fecha indicada (hoy en calendario Europe/Madrid).",
  "Salida obligatoria: markdown en español de España.",
  "Incluye secciones con encabezados ## claros:",
  "1) Comidas del día alineadas a los macros (por comida, estima gramos de macronutrientes cuando sea útil).",
  "2) Recordatorio de horarios del día (desayuno, ventana pre/post gimnasio, comida, merienda, cena) respetando las restricciones fijas.",
  "3) Bloque «Rutina gimnasio hoy»: usa `grupo_sesion`, `hidratacion_gym` y el texto de `ejercicios_markdown` del contexto; no inventes ejercicios si ya hay lista.",
  "Si `grupo_sesion` es DESCANSO, describe descanso o movilidad ligera sin inventar un entreno completo.",
].join("\n");

/**
 * Prompt de sistema: dieta + rutina diaria (markdown ES).
 */
export function buildNutritionDailyRoutineSystemPrompt(params: {
  readonly kcalTarget: number;
  readonly proteinG: number;
  readonly carbosG: number;
  readonly grasaG: number;
  readonly creatinaG: number;
  readonly aguaL: number;
}): string {
  return [buildNutritionDietSystemPrompt(params), "", "Instrucciones de formato y rutina:", DAILY_ROUTINE_INSTRUCTION_ES].join(
    "\n",
  );
}

function formatTelemetriaResumen(row: TelemetriaDiariaRow): string {
  const parts: string[] = [
    `fecha=${row.fecha}`,
    `pasos=${String(row.pasos ?? "—")}`,
    `calorías=${String(row.calorias_total ?? "—")}`,
    `sueño_h=${String(row.sueno_horas ?? "—")}`,
    `peso_kg=${String(row.peso_actual_kg ?? "—")}`,
    `hrv=${String(row.hrv_diario ?? "—")}`,
  ];
  return parts.join("; ");
}

/**
 * Mensaje usuario con contexto de rutina y telemetría opcional (ayer).
 */
export function buildNutritionDailyRoutineUserMessage(params: {
  readonly fechaMadrid: string;
  readonly diaSemanaEtiqueta: string;
  readonly rutina: RutinaOficialDiaDetail | null;
  readonly telemetriaAyer: TelemetriaDiariaRow | null;
  readonly entrenosHistoricoCompact: string;
}): string {
  const rutinaBlock =
    params.rutina === null
      ? "Sin fila en rutina_oficial para este día de la semana."
      : [
          `dia=${params.rutina.dia}`,
          `nombre_dia=${params.rutina.nombre_dia}`,
          `grupo_sesion=${params.rutina.grupo_sesion}`,
          `hidratacion_gym=${params.rutina.hidratacion_gym ?? "—"}`,
          "ejercicios_markdown:",
          params.rutina.ejercicios_markdown,
        ].join("\n");

  const telemBlock =
    params.telemetriaAyer === null
      ? "Sin telemetría de pulsera registrada para ayer (o no disponible)."
      : `Resumen telemetría ayer (${params.telemetriaAyer.fecha}): ${formatTelemetriaResumen(params.telemetriaAyer)}`;

  const entrenoBlock =
    params.entrenosHistoricoCompact.trim().length === 0
      ? "Sin bloque de entrenos recientes (vacío)."
      : params.entrenosHistoricoCompact.trim();

  return [
    `Fecha plan (Europe/Madrid): ${params.fechaMadrid}`,
    `Día de la semana (enum DB): ${params.diaSemanaEtiqueta}`,
    "",
    "=== Rutina oficial ===",
    rutinaBlock,
    "",
    "=== Contexto recuperación ===",
    telemBlock,
    "",
    "=== Entrenos recientes (compacto) ===",
    entrenoBlock,
  ].join("\n");
}
