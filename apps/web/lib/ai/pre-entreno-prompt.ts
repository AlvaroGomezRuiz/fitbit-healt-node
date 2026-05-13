import type { BiometriaMaestroRow } from "@/lib/data/biometria-maestro";
import type { MemoriaIaRow } from "@/lib/data/memoria-ia";
import type { ReporteHtmlRow } from "@/lib/data/reportes-html";
import type { TelemetriaDiariaRow } from "@/lib/data/telemetria-diaria";

const PRE_ENTRENO_SYSTEM_ES = [
  "Eres un asistente clínico-deportivo conservador: no inventes valores numéricos ausentes.",
  "Genera un informe pre-entreno en español de España para la sesión del día indicado (calendario Europe/Madrid).",
  "Salida obligatoria: un fragmento HTML5 válido (sin `<html>` ni `<body>`), envuelto en un `<article>` raíz.",
  "Usa `<h2>`, `<h3>`, listas `<ul>` y párrafos `<p>`. No uses markdown.",
  "Incluye secciones: 1) Estado y recuperación (sueño, HRV, pasos, carga si hay datos). 2) Hidratación y timing pre-entreno.",
  "3) Objetivos de la sesión alineados a biometría (peso, banderas, macros de referencia). 4) Riesgos / bandera roja si aplica.",
  "Si falta telemetría nocturna, dilo explícitamente y da orientación genérica sin cifras inventadas.",
].join("\n");

export function buildPreEntrenoSystemPrompt(): string {
  return PRE_ENTRENO_SYSTEM_ES;
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
    `hrv_baseline_7d=${bio.hrv_baseline_7d === null ? "—" : String(bio.hrv_baseline_7d)}`,
    `ultimo_top_set_squat=${bio.ultimo_top_set_squat === null ? "—" : String(bio.ultimo_top_set_squat)}`,
    `ultimo_top_set_press=${bio.ultimo_top_set_press === null ? "—" : String(bio.ultimo_top_set_press)}`,
  ].join("\n");
}

function formatMemoriaLines(rows: readonly MemoriaIaRow[]): string {
  if (rows.length === 0) {
    return "Sin líneas recientes en memoria_ia.";
  }
  const chronological = [...rows].reverse();
  return chronological.map((r) => `[${r.created_at}] ${r.contenido_linea}`).join("\n");
}

function formatResumenNocheHtml(row: ReporteHtmlRow | null): string {
  if (row === null) {
    return "Sin último RESUMEN_NOCHE en reportes_html.";
  }
  return [`fecha=${row.fecha}`, `nombre_archivo=${row.nombre_archivo}`, "html:", row.html_content].join("\n");
}

/**
 * Mensaje usuario: telemetría D-1 (noche previa civil Madrid), último resumen nocturno, memoria IA y biometría.
 */
export function buildPreEntrenoUserMessage(params: {
  readonly fechaMadrid: string;
  readonly telemetriaNochePrev: TelemetriaDiariaRow | null;
  readonly ultimoResumenNoche: ReporteHtmlRow | null;
  readonly memoriaTail: readonly MemoriaIaRow[];
  readonly biometria: BiometriaMaestroRow;
  readonly entrenosHistoricoCompact: string;
}): string {
  const telemBlock =
    params.telemetriaNochePrev === null
      ? "Sin fila telemetria_diaria para la noche previa (D-1 civil Madrid) o no disponible."
      : `Telemetría noche previa (${params.telemetriaNochePrev.fecha}): ${formatTelemetriaResumen(params.telemetriaNochePrev)}`;

  const entrenoBlock =
    params.entrenosHistoricoCompact.trim().length === 0
      ? "Sin bloque de entrenos recientes (vacío)."
      : params.entrenosHistoricoCompact.trim();

  return [
    `Fecha sesión (Europe/Madrid): ${params.fechaMadrid}`,
    "",
    "=== Telemetría (noche / día previo) ===",
    telemBlock,
    "",
    "=== Último RESUMEN_NOCHE ===",
    formatResumenNocheHtml(params.ultimoResumenNoche),
    "",
    "=== Memoria IA (cola reciente) ===",
    formatMemoriaLines(params.memoriaTail),
    "",
    "=== Entrenos recientes (compacto) ===",
    entrenoBlock,
    "",
    "=== Biometría maestro ===",
    formatBiometriaContext(params.biometria),
  ].join("\n");
}
