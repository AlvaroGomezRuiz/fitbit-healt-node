import { z } from "zod";

/**
 * Minutos desde medianoche civil en `Europe/Madrid` para `when` (intervalo semiabierto en minutos enteros).
 */
export function madridCivilTotalMinutesSinceMidnight(when: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(when);
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === "hour") {
      hour = Number.parseInt(p.value, 10);
    }
    if (p.type === "minute") {
      minute = Number.parseInt(p.value, 10);
    }
  }
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }
  return hour * 60 + minute;
}

/**
 * Etiqueta `HH:MM` civil Europe/Madrid (solo telemetría operativa, sin PII).
 */
export function madridCivilClockLabelHm(when: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(when);
  let hour = "00";
  let minute = "00";
  for (const p of parts) {
    if (p.type === "hour") {
      hour = p.value;
    }
    if (p.type === "minute") {
      minute = p.value;
    }
  }
  return `${hour}:${minute}`;
}

/** Ventana por defecto pre-entreno: [08:55, 09:15) civil Madrid (UTC fija en Vercel + doble disparo horario). */
export const PRE_ENTRENO_DEFAULT_START_MIN = 8 * 60 + 55;
export const PRE_ENTRENO_DEFAULT_END_EXCLUSIVE_MIN = 9 * 60 + 15;

/** Ventana pull telemetría previa: [08:35, 08:50) civil Madrid (~08:40). */
export const FITBIT_PULL_DEFAULT_START_MIN = 8 * 60 + 35;
export const FITBIT_PULL_DEFAULT_END_EXCLUSIVE_MIN = 8 * 60 + 50;

/** Ventana lista compra / menú semanal (domingo ~10:00 Madrid): [09:55, 10:15) civil Madrid. */
export const NUTRITION_SHOPPING_SUNDAY_DEFAULT_START_MIN = 9 * 60 + 55;
export const NUTRITION_SHOPPING_SUNDAY_DEFAULT_END_EXCLUSIVE_MIN = 10 * 60 + 15;

/** Ventana post-entreno (~14:30 Madrid): [14:20, 14:45) civil Madrid. */
export const POST_ENTRENO_DEFAULT_START_MIN = 14 * 60 + 20;
export const POST_ENTRENO_DEFAULT_END_EXCLUSIVE_MIN = 14 * 60 + 45;

/** Ventana informe semanal largo (domingo ~22:00 Madrid): [21:50, 22:25) civil Madrid. */
export const INFORME_SEMANAL_SUNDAY_DEFAULT_START_MIN = 21 * 60 + 50;
export const INFORME_SEMANAL_SUNDAY_DEFAULT_END_EXCLUSIVE_MIN = 22 * 60 + 25;

function clockToMinutes(hm: string): number | null {
  const clockSchema = z.string().regex(/^\d{2}:\d{2}$/);
  const parsed = clockSchema.safeParse(hm);
  if (!parsed.success) {
    return null;
  }
  const [hStr, mStr] = parsed.data.split(":");
  if (hStr === undefined || mStr === undefined) {
    return null;
  }
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr, 10);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

/**
 * Lee `CRON_PRE_ENTRENO_WINDOW=HH:MM-HH:MM` (fin exclusivo). Si falta o es inválido, usa defaults §PRE_ENTRENO_*.
 */
export function readPreEntrenoMadridWindowFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): { readonly startMin: number; readonly endExclusiveMin: number } {
  const raw = env.CRON_PRE_ENTRENO_WINDOW?.trim();
  if (raw === undefined || raw === "") {
    return { startMin: PRE_ENTRENO_DEFAULT_START_MIN, endExclusiveMin: PRE_ENTRENO_DEFAULT_END_EXCLUSIVE_MIN };
  }
  const halves = raw.split("-");
  if (halves.length !== 2) {
    return { startMin: PRE_ENTRENO_DEFAULT_START_MIN, endExclusiveMin: PRE_ENTRENO_DEFAULT_END_EXCLUSIVE_MIN };
  }
  const left = halves[0]?.trim() ?? "";
  const right = halves[1]?.trim() ?? "";
  const startMin = clockToMinutes(left);
  const endExclusiveMin = clockToMinutes(right);
  if (startMin === null || endExclusiveMin === null || startMin >= endExclusiveMin) {
    return { startMin: PRE_ENTRENO_DEFAULT_START_MIN, endExclusiveMin: PRE_ENTRENO_DEFAULT_END_EXCLUSIVE_MIN };
  }
  return { startMin, endExclusiveMin };
}

/**
 * Lee `CRON_NUTRITION_SHOPPING_WINDOW=HH:MM-HH:MM` (fin exclusivo). Si falta o es inválido, usa defaults §NUTRITION_SHOPPING_SUNDAY_*.
 */
export function readNutritionShoppingSundayMadridWindowFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): { readonly startMin: number; readonly endExclusiveMin: number } {
  const raw = env.CRON_NUTRITION_SHOPPING_WINDOW?.trim();
  if (raw === undefined || raw === "") {
    return {
      startMin: NUTRITION_SHOPPING_SUNDAY_DEFAULT_START_MIN,
      endExclusiveMin: NUTRITION_SHOPPING_SUNDAY_DEFAULT_END_EXCLUSIVE_MIN,
    };
  }
  const halves = raw.split("-");
  if (halves.length !== 2) {
    return {
      startMin: NUTRITION_SHOPPING_SUNDAY_DEFAULT_START_MIN,
      endExclusiveMin: NUTRITION_SHOPPING_SUNDAY_DEFAULT_END_EXCLUSIVE_MIN,
    };
  }
  const left = halves[0]?.trim() ?? "";
  const right = halves[1]?.trim() ?? "";
  const startMin = clockToMinutes(left);
  const endExclusiveMin = clockToMinutes(right);
  if (startMin === null || endExclusiveMin === null || startMin >= endExclusiveMin) {
    return {
      startMin: NUTRITION_SHOPPING_SUNDAY_DEFAULT_START_MIN,
      endExclusiveMin: NUTRITION_SHOPPING_SUNDAY_DEFAULT_END_EXCLUSIVE_MIN,
    };
  }
  return { startMin, endExclusiveMin };
}

/**
 * Lee `CRON_POST_ENTRENO_WINDOW=HH:MM-HH:MM` (fin exclusivo). Si falta o es inválido, usa defaults §POST_ENTRENO_*.
 */
export function readPostEntrenoMadridWindowFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): { readonly startMin: number; readonly endExclusiveMin: number } {
  const raw = env.CRON_POST_ENTRENO_WINDOW?.trim();
  if (raw === undefined || raw === "") {
    return {
      startMin: POST_ENTRENO_DEFAULT_START_MIN,
      endExclusiveMin: POST_ENTRENO_DEFAULT_END_EXCLUSIVE_MIN,
    };
  }
  const halves = raw.split("-");
  if (halves.length !== 2) {
    return {
      startMin: POST_ENTRENO_DEFAULT_START_MIN,
      endExclusiveMin: POST_ENTRENO_DEFAULT_END_EXCLUSIVE_MIN,
    };
  }
  const left = halves[0]?.trim() ?? "";
  const right = halves[1]?.trim() ?? "";
  const startMin = clockToMinutes(left);
  const endExclusiveMin = clockToMinutes(right);
  if (startMin === null || endExclusiveMin === null || startMin >= endExclusiveMin) {
    return {
      startMin: POST_ENTRENO_DEFAULT_START_MIN,
      endExclusiveMin: POST_ENTRENO_DEFAULT_END_EXCLUSIVE_MIN,
    };
  }
  return { startMin, endExclusiveMin };
}

/**
 * Lee `CRON_INFORME_SEMANAL_WINDOW=HH:MM-HH:MM` (fin exclusivo). Si falta o es inválido, usa defaults §INFORME_SEMANAL_SUNDAY_*.
 */
export function readInformeSemanalSundayMadridWindowFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): { readonly startMin: number; readonly endExclusiveMin: number } {
  const raw = env.CRON_INFORME_SEMANAL_WINDOW?.trim();
  if (raw === undefined || raw === "") {
    return {
      startMin: INFORME_SEMANAL_SUNDAY_DEFAULT_START_MIN,
      endExclusiveMin: INFORME_SEMANAL_SUNDAY_DEFAULT_END_EXCLUSIVE_MIN,
    };
  }
  const halves = raw.split("-");
  if (halves.length !== 2) {
    return {
      startMin: INFORME_SEMANAL_SUNDAY_DEFAULT_START_MIN,
      endExclusiveMin: INFORME_SEMANAL_SUNDAY_DEFAULT_END_EXCLUSIVE_MIN,
    };
  }
  const left = halves[0]?.trim() ?? "";
  const right = halves[1]?.trim() ?? "";
  const startMin = clockToMinutes(left);
  const endExclusiveMin = clockToMinutes(right);
  if (startMin === null || endExclusiveMin === null || startMin >= endExclusiveMin) {
    return {
      startMin: INFORME_SEMANAL_SUNDAY_DEFAULT_START_MIN,
      endExclusiveMin: INFORME_SEMANAL_SUNDAY_DEFAULT_END_EXCLUSIVE_MIN,
    };
  }
  return { startMin, endExclusiveMin };
}

export function isWithinMadridHalfOpenMinuteWindow(params: {
  readonly when: Date;
  readonly startMin: number;
  readonly endExclusiveMin: number;
}): boolean {
  const t = madridCivilTotalMinutesSinceMidnight(params.when);
  return t >= params.startMin && t < params.endExclusiveMin;
}
