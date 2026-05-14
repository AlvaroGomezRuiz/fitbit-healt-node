import * as React from "react";

import { HealthTelemetriaPanel } from "@/components/features/health-telemetria-panel";
import { parseGoogleFitWebUrlFromEnv } from "@/lib/health/google-fit-web-url";
import {
  buildUtcDateRangeInclusive,
  fetchTelemetriaUltimosDias,
  type TelemetriaDiariaFetchResult,
  type TelemetriaDiariaRow,
} from "@/lib/data/telemetria-diaria";
import { parseFitbitFeatureFlagsFromEnv, parseFitbitMasterFromEnv } from "@/lib/fitbit/config";
import { SINGLE_USER_PLACEHOLDERS } from "@/lib/ui/single-user-placeholders";

export const dynamic = "force-dynamic";

const VENTANA_DIAS = 7;

export default async function HealthPage(): Promise<React.ReactElement> {
  const masterOn = parseFitbitMasterFromEnv(process.env);
  const flags = parseFitbitFeatureFlagsFromEnv(process.env);
  const sinFilas: readonly TelemetriaDiariaRow[] = [];
  const telemetria: TelemetriaDiariaFetchResult = flags.uiEnabled
    ? await fetchTelemetriaUltimosDias({ days: VENTANA_DIAS })
    : { ok: true, rows: sinFilas };
  const fechasVacias: readonly string[] = [];
  const fechas = flags.uiEnabled ? buildUtcDateRangeInclusive(new Date(), VENTANA_DIAS) : fechasVacias;
  const googleFitWebUrl = parseGoogleFitWebUrlFromEnv(process.env);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="health-heading">
      <header className="flex flex-col gap-1">
        <h1 id="health-heading" className="text-xl font-semibold tracking-tight text-foreground">
          Salud
        </h1>
        <p className="text-sm text-muted-foreground">
          Esta sección concentra la telemetría de la pulsera para ver tendencias de actividad, sueño y pasos en un solo
          lugar.
        </p>
        <p className="text-sm text-muted-foreground">
          Sirve como apoyo al entrenamiento y la nutrición; no sustituye el criterio clínico cuando aplique.
        </p>
        {flags.uiEnabled ? (
          <p className="text-sm text-muted-foreground">
            {SINGLE_USER_PLACEHOLDERS.salud.telemetriaContexto} Ventana mostrada: {VENTANA_DIAS} días en UTC.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aquí verías tendencias de sueño, pasos y FC cuando conectes la telemetría de la pulsera. Mientras tanto
            puedes usar el resto de la app con normalidad.
          </p>
        )}
      </header>

      {!flags.uiEnabled ? (
        <div
          className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
          role="status"
        >
          <p className="font-medium text-foreground">Telemetría no disponible</p>
          <p className="mt-2 leading-relaxed">
            {masterOn ? (
              <>
                El maestro <code className="rounded bg-muted px-1 text-foreground">FITBIT_ACTIVO</code> está activo,
                pero la UI de telemetría no: define{" "}
                <code className="rounded bg-muted px-1 text-foreground">NEXT_PUBLIC_FITBIT_UI_ENABLED=true</code> o{" "}
                <code className="rounded bg-muted px-1 text-foreground">1</code> en{" "}
                <code className="rounded bg-muted px-1 text-foreground">frontend/.env.local</code> (Vercel: variables de{" "}
                <span className="font-mono text-foreground">frontend</span>).
              </>
            ) : (
              <>
                La pila Fitbit / Google Health está apagada:{" "}
                <code className="rounded bg-muted px-1 text-foreground">FITBIT_ACTIVO</code> debe ser{" "}
                <span className="font-mono text-foreground">true</span> o <span className="font-mono text-foreground">1</span>{" "}
                en servidor (p. ej. Vercel). Luego puedes activar la UI con{" "}
                <code className="rounded bg-muted px-1 text-foreground">NEXT_PUBLIC_FITBIT_UI_ENABLED</code>.
              </>
            )}
          </p>
        </div>
      ) : (
        <HealthTelemetriaPanel fechas={fechas} syncEnabled={flags.syncEnabled} result={telemetria} googleFitWebUrl={googleFitWebUrl} />
      )}
    </section>
  );
}
