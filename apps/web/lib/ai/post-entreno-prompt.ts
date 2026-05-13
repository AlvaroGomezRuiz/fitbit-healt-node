import type { BiometriaMaestroRow } from "@/lib/data/biometria-maestro";
import type { TelemetriaDiariaRow } from "@/lib/data/telemetria-diaria";

const POST_ENTRENO_SYSTEM_ES = [
  "Eres un asistente clínico-deportivo conservador: no inventes valores numéricos ausentes.",
  "Genera un informe post-entreno en español de España para la sesión ya realizada (calendario Europe/Madrid).",
  "Salida obligatoria: un fragmento HTML5 válido (sin `<html>` ni `<body>`), envuelto en un `<article>` raíz.",
  "Usa `<h2>`, `<h3>`, listas `<ul>` y párrafos `<p>`. No uses markdown.",
  "Incluye secciones: 1) Resumen de la sesión según datos aportados. 2) Recuperación inmediata (hidratación, comida, sueño si aplica).",
  "3) Señales de telemetría del día (pasos, FC, carga) sin alarmismo. 4) Próximos pasos hasta el día siguiente.",
  "Si no hay filas de entreno para la fecha, dilo y ofrece orientación genérica de cierre de día sin inventar cargas.",
].join("\n");

export function buildPostEntrenoSystemPrompt(): string {
  return POST_ENTRENO_SYSTEM_ES;
}

function formatTelemetriaResumen(row: TelemetriaDiariaRow): string {
  const parts: readonly string[] = [
    `fecha=${row.fecha}`,
    `pasos=${String(row.pasos ?? "—")}`,
    `calorías=${String(row.calorias_total ?? "—")}`,
    `sueño_h=${String(row.sueno_horas ?? "—")}`,
    `sueño_eficiencia=${String(row.sueno_eficiencia ?? "—")}`,
    `peso_kg=${String(row.peso_actual_kg ?? "—")}`,
    `hrv=${String(row.hrv_diario ?? "—")}`,
    `frecuencia_reposo_bpm=${String(row.frecuencia_reposo_bpm ?? "—")}`,
  ];
  return parts.join("; ");
}

function formatBiometriaContext(bio: BiometriaMaestroRow): string {
  return [
    `nombre=${bio.nombre}`,
    `peso_kg=${String(bio.peso_kg)}`,
    `imc=${String(bio.imc)}`,
    `objetivo_tipo=${bio.objetivo_tipo}`,
    `kcal_target=${String(bio.kcal_target)}`,
    `proteina_g=${String(bio.proteina_g)}`,
    `carbos_g=${String(bio.carbos_g)}`,
    `grasa_g=${String(bio.grasa_g)}`,
    `creatina_g=${String(bio.creatina_g)}`,
    `agua_l=${String(bio.agua_l)}`,
    `bandera_roja=${String(bio.bandera_roja)}`,
    `motivo_bandera_roja=${bio.motivo_bandera_roja ?? "—"}`,
  ].join("\n");
}

/**
 * Mensaje usuario: telemetría del día civil Madrid, entrenos de esa fecha y biometría.
 */
export function buildPostEntrenoUserMessage(params: {
  readonly fechaMadrid: string;
  readonly telemetriaHoy: TelemetriaDiariaRow | null;
  readonly entrenosDiaCompact: string;
  readonly biometria: BiometriaMaestroRow;
}): string {
  const telemBlock =
    params.telemetriaHoy === null
      ? "Sin fila telemetria_diaria para hoy (fecha civil Madrid) o no disponible."
      : `Telemetría hoy (${params.telemetriaHoy.fecha}): ${formatTelemetriaResumen(params.telemetriaHoy)}`;

  const entrenoBlock =
    params.entrenosDiaCompact.trim().length === 0
      ? "Sin bloque de entrenos del día (vacío)."
      : params.entrenosDiaCompact.trim();

  return [
    `Fecha sesión (Europe/Madrid): ${params.fechaMadrid}`,
    "",
    "=== Telemetría (día civil actual) ===",
    telemBlock,
    "",
    "=== Entrenos del día (session_date) ===",
    entrenoBlock,
    "",
    "=== Biometría maestro ===",
    formatBiometriaContext(params.biometria),
  ].join("\n");
}
