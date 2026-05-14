/**
 * Presentación legible de `telemetria_diaria.resumen_critico` (JSONB) sin volcar objetos enormes.
 */

const MAX_VALUE_CHARS = 120;
const DEFAULT_MAX_ENTRIES = 12;

export interface TelemetriaResumenLine {
  readonly key: string;
  readonly value: string;
}

function stringifyUnknown(value: unknown, maxLen: number): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    return value.length > maxLen ? `${value.slice(0, maxLen - 1)}…` : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "sí" : "no";
  }
  try {
    const s = JSON.stringify(value);
    return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
  } catch {
    return "—";
  }
}

/**
 * Convierte el mapa `resumen_critico` en líneas ordenadas para UI tipo "TELEMETRÍA clave: valor".
 */
export function buildTelemetriaResumenCriticoLines(
  record: Readonly<Record<string, unknown>>,
  maxEntries: number = DEFAULT_MAX_ENTRIES,
): readonly TelemetriaResumenLine[] {
  const keys = Object.keys(record).sort((a, b) => a.localeCompare(b, "es"));
  const lim = Math.min(Math.max(maxEntries, 1), 40);
  const out: TelemetriaResumenLine[] = [];
  for (const key of keys) {
    if (out.length >= lim) {
      break;
    }
    const v = record[key];
    if (v === undefined) {
      continue;
    }
    out.push({ key, value: stringifyUnknown(v, MAX_VALUE_CHARS) });
  }
  return out;
}
