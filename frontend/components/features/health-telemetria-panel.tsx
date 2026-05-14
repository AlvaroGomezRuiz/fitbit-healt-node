import * as React from "react";

import { MiniSparkline } from "@/components/features/health-telemetry-sparkline";
import { HealthTelemetriaResumenCritico } from "@/components/features/salud/health-telemetria-resumen-critico";
import type { TelemetriaDiariaFetchResult, TelemetriaDiariaRow } from "@/lib/data/telemetria-diaria";
import { emptyTelemetryDateRange, hintTelemetryRls } from "@/lib/ui/single-user-placeholders";

interface HealthTelemetriaPanelProps {
  readonly fechas: readonly string[];
  readonly syncEnabled: boolean;
  readonly result: TelemetriaDiariaFetchResult;
  readonly googleFitWebUrl: string | null;
}

function alignSeries(
  fechas: readonly string[],
  rows: readonly TelemetriaDiariaRow[],
  pick: (r: TelemetriaDiariaRow) => number | null,
): readonly (number | null)[] {
  const map = new Map<string, TelemetriaDiariaRow>();
  for (const r of rows) {
    map.set(r.fecha, r);
  }
  return fechas.map((f) => {
    const row = map.get(f);
    if (row === undefined) {
      return null;
    }
    return pick(row);
  });
}

function trendVsPriorMean(values: readonly (number | null)[]): string {
  const v = values.filter((x): x is number => x !== null && !Number.isNaN(x));
  if (v.length < 2) {
    return "Sin tendencia: faltan datos previos.";
  }
  const last = v.at(-1);
  if (last === undefined) {
    return "Sin tendencia: faltan datos previos.";
  }
  const prior = v.slice(0, -1);
  const m = prior.reduce((a, b) => a + b, 0) / prior.length;
  if (m === 0) {
    return "—";
  }
  const rel = (last - m) / Math.abs(m);
  if (Math.abs(rel) < 0.03) {
    return "Último día cercano a la media de los anteriores.";
  }
  return rel > 0
    ? "Último día por encima de la media de los anteriores."
    : "Último día por debajo de la media de los anteriores.";
}

function formatShortDate(iso: string): string {
  const tail = iso.slice(5);
  return tail.length > 0 ? tail : iso;
}

export function HealthTelemetriaPanel(props: HealthTelemetriaPanelProps): React.ReactElement {
  const { fechas, syncEnabled, result, googleFitWebUrl } = props;
  const latestRow =
    result.ok && result.rows.length > 0 ? result.rows[0] ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      {!syncEnabled ? (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-100"
          role="status"
        >
          <p className="font-medium">Sincronización desactivada</p>
          <p className="mt-1 text-muted-foreground">
            Activa <code className="rounded bg-muted px-1 text-foreground">FITBIT_SYNC_ENABLED</code> con{" "}
            <span className="text-foreground">true</span> o <span className="text-foreground">1</span>, o déjalo vacío
            para heredar el mismo criterio estricto de{" "}
            <code className="rounded bg-muted px-1 text-foreground">FITBIT_ACTIVO</code> (maestro). Si no, los datos
            pueden estar desactualizados.
          </p>
        </div>
      ) : null}

      {!result.ok ? (
        <div
          className={`rounded-lg border p-4 text-sm ${
            result.code === "missing_env"
              ? "border-dashed border-amber-500/40 bg-amber-500/5 text-amber-100"
              : "border-dashed border-destructive/40 bg-destructive/5 text-destructive"
          }`}
          role={result.code === "missing_env" ? "status" : "alert"}
        >
          <p className="font-medium">
            {result.code === "missing_env" ? "Sin conexión a Supabase" : "No se pudo leer telemetría"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {result.message}{" "}
            {result.code === "query_error" || result.code === "row_shape" ? (
              <> {hintTelemetryRls}</>
            ) : null}
          </p>
        </div>
      ) : (
        <>
          <HealthTelemetriaResumenCritico latestRow={latestRow} googleFitWebUrl={googleFitWebUrl} />
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground" aria-hidden>
            {fechas.map((f) => (
              <span key={f} className="rounded bg-muted px-2 py-0.5 font-mono text-foreground">
                {formatShortDate(f)}
              </span>
            ))}
          </div>

          {result.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground" role="status">
              {emptyTelemetryDateRange}
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                title="Sueño"
                subtitle="Horas registradas (últimos 7 días UTC)"
                series={alignSeries(fechas, result.rows, (r) => r.sueno_horas)}
                formatValue={(n) => `${n.toFixed(1)} h`}
                sparkAria="Tendencia de horas de sueño en 7 días"
              />
              <MetricCard
                title="Frecuencia cardíaca en reposo"
                subtitle="Promedio diario (lpm)"
                series={alignSeries(fechas, result.rows, (r) =>
                  r.frecuencia_reposo_bpm === null ? null : r.frecuencia_reposo_bpm,
                )}
                formatValue={(n) => `${Math.round(n)} lpm`}
                sparkAria="Tendencia de FC en reposo en 7 días"
              />
              <MetricCard
                title="Pasos"
                subtitle="Total diario"
                series={alignSeries(fechas, result.rows, (r) => (r.pasos === null ? null : r.pasos))}
                formatValue={(n) => `${Math.round(n)}`}
                sparkAria="Tendencia de pasos en 7 días"
              />
              <MetricCard
                title="HRV"
                subtitle="Variabilidad (unidad del snapshot)"
                series={alignSeries(fechas, result.rows, (r) => r.hrv_diario)}
                formatValue={(n) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))}
                sparkAria="Tendencia de HRV en 7 días"
              />
            </ul>
          )}
        </>
      )}
    </div>
  );
}

interface MetricCardProps {
  readonly title: string;
  readonly subtitle: string;
  readonly series: readonly (number | null)[];
  readonly formatValue: (n: number) => string;
  readonly sparkAria: string;
}

function MetricCard(props: MetricCardProps): React.ReactElement {
  const { title, subtitle, series, formatValue, sparkAria } = props;
  const lastVal = [...series].reverse().find((x): x is number => x !== null && !Number.isNaN(x));
  const trend = trendVsPriorMean(series);

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
        {lastVal === undefined ? "—" : formatValue(lastVal)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{trend}</p>
      <div className="mt-3">
        <MiniSparkline values={series} ariaLabel={sparkAria} />
      </div>
    </li>
  );
}
