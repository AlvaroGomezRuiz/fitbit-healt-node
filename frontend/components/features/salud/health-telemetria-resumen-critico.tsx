import * as React from "react";

import { buildTelemetriaResumenCriticoLines } from "@/lib/health/telemetria-resumen-lines";
import type { TelemetriaDiariaRow } from "@/lib/data/telemetria-diaria";

export interface HealthTelemetriaResumenCriticoProps {
  readonly latestRow: TelemetriaDiariaRow | null;
  readonly googleFitWebUrl: string | null;
}

export function HealthTelemetriaResumenCritico({
  latestRow,
  googleFitWebUrl,
}: HealthTelemetriaResumenCriticoProps): React.ReactElement {
  const lines =
    latestRow === null ? [] : buildTelemetriaResumenCriticoLines(latestRow.resumen_critico);

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="tele-resumen-critico-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h2 id="tele-resumen-critico-title" className="text-sm font-semibold text-foreground">
          Resumen crítico (telemetría)
        </h2>
        {googleFitWebUrl !== null ? (
          <p className="text-xs shrink-0">
            <a
              href={googleFitWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Abre Google Fit en una pestaña nueva"
              aria-label="Detalle en Google Fit (se abre en una pestaña nueva)"
              className="rounded-sm font-medium text-ring underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Detalle en Google Fit
            </a>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Enlace a Google Fit no configurado.</p>
        )}
      </div>
      {latestRow === null ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          Sin fila reciente de telemetría en la ventana mostrada.
        </p>
      ) : lines.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          El campo <span className="font-mono text-xs">resumen_critico</span> está vacío para el día{" "}
          <span className="font-mono text-foreground">{latestRow.fecha}</span>. Usa las tarjetas inferiores (pasos,
          sueño, etc.) o revisa la ingesta.
        </p>
      ) : (
        <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          {lines.map((line) => (
            <div key={line.key} className="min-w-0 border-b border-border/60 pb-2 last:border-0 sm:border-0 sm:pb-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                TELEMETRÍA {line.key}
              </dt>
              <dd className="mt-0.5 wrap-break-word font-mono text-xs text-foreground">{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {latestRow !== null ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Día referencia: <span className="font-mono text-foreground">{latestRow.fecha}</span> · actualizado{" "}
          <span className="font-mono text-foreground">{latestRow.updated_at}</span>
        </p>
      ) : null}
    </section>
  );
}
