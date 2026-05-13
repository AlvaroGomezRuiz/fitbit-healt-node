/**
 * Fecha civil actual en `Europe/Madrid` como `YYYY-MM-DD`.
 */
export function todayMadridIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Día de la semana estilo JS (`0` = domingo) para `isoYmd` interpretado al mediodía UTC, en zona Madrid.
 */
export function getJsDayOfWeekMadrid(isoYmd: string): number {
  const d = new Date(`${isoYmd}T12:00:00.000Z`);
  const wd = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "Europe/Madrid" });
  const map: Readonly<Record<string, number>> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const n = map[wd];
  return typeof n === "number" ? n : 0;
}

/** `true` si `isoYmd` es domingo en calendario civil Europe/Madrid. */
export function isSundayEuropeMadrid(isoYmd: string): boolean {
  return getJsDayOfWeekMadrid(isoYmd) === 0;
}

const JS_WEEKDAY_TO_DIA = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

type DiaSemanaFromMadrid = (typeof JS_WEEKDAY_TO_DIA)[number];

/**
 * Mapea `getJsDayOfWeekMadrid` (0=domingo) a valor enum `public.dia_semana` en Postgres.
 */
export function diaSemanaDbFromMadridIso(isoYmd: string): DiaSemanaFromMadrid {
  const idx = getJsDayOfWeekMadrid(isoYmd);
  const v = JS_WEEKDAY_TO_DIA[idx];
  return v ?? "MON";
}

/**
 * Suma días en calendario UTC sobre `YYYY-MM-DD` (navegación estable entre pestañas).
 */
export function addDaysIsoUtc(isoYmd: string, delta: number): string {
  const parts = isoYmd.split("-");
  if (parts.length !== 3) {
    return isoYmd;
  }
  const yStr = parts[0];
  const mStr = parts[1];
  const dStr = parts[2];
  if (yStr === undefined || mStr === undefined || dStr === undefined) {
    return isoYmd;
  }
  const y = Number.parseInt(yStr, 10);
  const m = Number.parseInt(mStr, 10);
  const day = Number.parseInt(dStr, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) {
    return isoYmd;
  }
  const dt = new Date(Date.UTC(y, m - 1, day + delta));
  return dt.toISOString().slice(0, 10);
}

/**
 * Lunes civil de la semana que contiene `isoYmd` (Europe/Madrid), como `YYYY-MM-DD`.
 * Útil para claves idempotentes semanales (p. ej. lista de compra del lunes).
 */
export function mondayOfWeekMadridIso(isoYmd: string): string {
  const dow = getJsDayOfWeekMadrid(isoYmd);
  const daysSinceMonday = (dow + 6) % 7;
  return addDaysIsoUtc(isoYmd, -daysSinceMonday);
}
