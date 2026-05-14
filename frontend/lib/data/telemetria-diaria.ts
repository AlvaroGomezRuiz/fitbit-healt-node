import "server-only";

import { parseFitbitFeatureFlagsFromEnv } from "@/lib/fitbit/config";
import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const jsonObjectRecordSchema = z
  .union([z.record(z.string(), z.unknown()), z.null()])
  .transform((v): Record<string, unknown> => (v === null ? {} : v));

/** Fila alineada a `public.telemetria_diaria` (migración fase 1). */
export const telemetriaDiariaRowSchema = z.object({
  fecha: z.string(),
  pulsera_activa: z
    .union([z.boolean(), z.null()])
    .transform((v): boolean => (v === null ? false : v)),
  generado_en: z.string().nullable(),
  sueno_horas: z.number().nullable(),
  sueno_eficiencia: z.number().nullable(),
  sueno_rem_min: z.number().nullable(),
  sueno_profundo_min: z.number().nullable(),
  hrv_diario: z.number().nullable(),
  frecuencia_reposo_bpm: z.number().nullable(),
  spo2_promedio_pct: z.number().nullable(),
  pasos: z.number().nullable(),
  calorias_total: z.number().nullable(),
  active_zone_min: z.number().nullable(),
  vo2_max: z.number().nullable(),
  peso_actual_kg: z.number().nullable(),
  resumen_critico: jsonObjectRecordSchema,
  snapshot_completo: jsonObjectRecordSchema,
  drive_json_file_id: z.string().nullable(),
  updated_at: z.string(),
});

export type TelemetriaDiariaRow = z.infer<typeof telemetriaDiariaRowSchema>;

export type TelemetriaDiariaFetchResult =
  | { readonly ok: true; readonly rows: readonly TelemetriaDiariaRow[] }
  | {
      readonly ok: false;
      readonly code: "missing_env" | "query_error" | "row_shape";
      readonly message: string;
    };

export type ListTelemetriaDiariaResult =
  | { readonly disabled: true }
  | {
      readonly disabled: false;
      readonly ok: true;
      readonly rows: readonly TelemetriaDiariaRow[];
    }
  | {
      readonly disabled: false;
      readonly ok: false;
      readonly code: "missing_env" | "query_error" | "row_shape";
      readonly message: string;
    };

export const telemetriaDiariaSelectColumns =
  "fecha,pulsera_activa,generado_en,sueno_horas,sueno_eficiencia,sueno_rem_min,sueno_profundo_min,hrv_diario,frecuencia_reposo_bpm,spo2_promedio_pct,pasos,calorias_total,active_zone_min,vo2_max,peso_actual_kg,resumen_critico,snapshot_completo,drive_json_file_id,updated_at" as const;

/**
 * Últimos `dayCount` días civiles en UTC como `YYYY-MM-DD`, del más antiguo al más reciente (incluye hoy UTC respecto a `anchor`).
 */
export function buildUtcDateRangeInclusive(anchor: Date, dayCount: number): readonly string[] {
  const n =
    Number.isFinite(dayCount) && dayCount > 0 ? Math.min(Math.floor(dayCount), 90) : 7;
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Lista `telemetria_diaria` en la ventana UTC de los últimos `days` días (incluye hoy), orden descendente por `fecha`.
 * Si el maestro `FITBIT_ACTIVO` no está activo o `NEXT_PUBLIC_FITBIT_UI_ENABLED` no lo está, devuelve `{ disabled: true }` sin consultar.
 */
export async function listTelemetriaDiaria(params: {
  readonly days: number;
}): Promise<ListTelemetriaDiariaResult> {
  const flags = parseFitbitFeatureFlagsFromEnv(process.env);
  if (!flags.uiEnabled) {
    return { disabled: true };
  }

  const days =
    Number.isFinite(params.days) && params.days > 0 ? Math.min(Math.floor(params.days), 90) : 7;

  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      disabled: false,
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend/.env.local.",
    };
  }

  try {
    const fechas = buildUtcDateRangeInclusive(new Date(), days);
    const desde = fechas[0];
    const hasta = fechas[fechas.length - 1];
    if (desde === undefined || hasta === undefined) {
      return {
        disabled: false,
        ok: false,
        code: "query_error",
        message: "No se pudo calcular el rango de fechas UTC.",
      };
    }

    const { data, error } = await supabase
      .from("telemetria_diaria")
      .select(telemetriaDiariaSelectColumns)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false });

    if (error !== null) {
      return {
        disabled: false,
        ok: false,
        code: "query_error",
        message: publicSupabaseQueryFailureMessage(error.message),
      };
    }

    const rawRows = data ?? [];
    const rows: TelemetriaDiariaRow[] = [];
    for (const item of rawRows) {
      const rowParsed = telemetriaDiariaRowSchema.safeParse(item);
      if (!rowParsed.success) {
        return {
          disabled: false,
          ok: false,
          code: "row_shape",
          message: "Formato de fila inesperado en telemetria_diaria.",
        };
      }
      rows.push(rowParsed.data);
    }

    return { disabled: false, ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer telemetría.";
    return { disabled: false, ok: false, code: "query_error", message };
  }
}

/**
 * Mapea `listTelemetriaDiaria` al contrato del panel `/health` (sin rama `disabled`).
 */
export async function fetchTelemetriaUltimosDias(params: {
  readonly days: number;
}): Promise<TelemetriaDiariaFetchResult> {
  const listed = await listTelemetriaDiaria(params);
  if (listed.disabled) {
    return { ok: true, rows: [] };
  }
  if (!listed.ok) {
    return { ok: false, code: listed.code, message: listed.message };
  }
  return { ok: true, rows: listed.rows };
}

export type FetchLatestTelemetriaDiariaResult =
  | { readonly ok: true; readonly row: TelemetriaDiariaRow | null; readonly uiQuerySkipped?: true }
  | {
      readonly ok: false;
      readonly code: "missing_env" | "query_error" | "row_shape";
      readonly message: string;
    };

/**
 * Última fila disponible por `fecha` descendente.
 * Si el maestro `FITBIT_ACTIVO` no está activo o `NEXT_PUBLIC_FITBIT_UI_ENABLED` no lo está, no consulta Supabase y
 * devuelve `{ ok: true, row: null, uiQuerySkipped: true }`.
 */
export async function fetchLatestTelemetriaDiaria(): Promise<FetchLatestTelemetriaDiariaResult> {
  const flags = parseFitbitFeatureFlagsFromEnv(process.env);
  if (!flags.uiEnabled) {
    return { ok: true, row: null, uiQuerySkipped: true };
  }

  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend/.env.local.",
    };
  }
  try {
    const { data, error } = await supabase
      .from("telemetria_diaria")
      .select(telemetriaDiariaSelectColumns)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error !== null) {
      return { ok: false, code: "query_error", message: publicSupabaseQueryFailureMessage(error.message) };
    }
    if (data === null) {
      return { ok: true, row: null };
    }
    const rowParsed = telemetriaDiariaRowSchema.safeParse(data);
    if (!rowParsed.success) {
      return { ok: false, code: "row_shape", message: "Formato de fila inesperado en telemetria_diaria." };
    }
    return { ok: true, row: rowParsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer telemetría.";
    return { ok: false, code: "query_error", message };
  }
}

export type FetchTelemetriaDiariaByFechaResult =
  | { readonly ok: true; readonly row: TelemetriaDiariaRow | null; readonly uiQuerySkipped?: true }
  | {
      readonly ok: false;
      readonly code: "missing_env" | "query_error" | "row_shape";
      readonly message: string;
    };

/**
 * Fila de telemetría para una fecha concreta (`YYYY-MM-DD`).
 * Si el maestro `FITBIT_ACTIVO` no está activo o `NEXT_PUBLIC_FITBIT_UI_ENABLED` no lo está, no consulta Supabase y
 * devuelve `{ ok: true, row: null, uiQuerySkipped: true }`.
 */
export async function fetchTelemetriaDiariaByFecha(params: {
  readonly fecha: string;
}): Promise<FetchTelemetriaDiariaByFechaResult> {
  const flags = parseFitbitFeatureFlagsFromEnv(process.env);
  if (!flags.uiEnabled) {
    return { ok: true, row: null, uiQuerySkipped: true };
  }

  const fechaOk = /^\d{4}-\d{2}-\d{2}$/u.test(params.fecha);
  if (!fechaOk) {
    return { ok: false, code: "query_error", message: "Fecha inválida (se espera YYYY-MM-DD)." };
  }
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return {
      ok: false,
      code: "missing_env",
      message:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en frontend/.env.local.",
    };
  }
  try {
    const { data, error } = await supabase
      .from("telemetria_diaria")
      .select(telemetriaDiariaSelectColumns)
      .eq("fecha", params.fecha)
      .maybeSingle();
    if (error !== null) {
      return { ok: false, code: "query_error", message: publicSupabaseQueryFailureMessage(error.message) };
    }
    if (data === null) {
      return { ok: true, row: null };
    }
    const rowParsed = telemetriaDiariaRowSchema.safeParse(data);
    if (!rowParsed.success) {
      return { ok: false, code: "row_shape", message: "Formato de fila inesperado en telemetria_diaria." };
    }
    return { ok: true, row: rowParsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer telemetría.";
    return { ok: false, code: "query_error", message };
  }
}
