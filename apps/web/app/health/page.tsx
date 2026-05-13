import * as React from "react";

import { HealthTelemetriaPanel } from "@/components/features/health-telemetria-panel";
import {
  buildUtcDateRangeInclusive,
  fetchTelemetriaUltimosDias,
  type TelemetriaDiariaFetchResult,
  type TelemetriaDiariaRow,
} from "@/lib/data/telemetria-diaria";
import { parseFitbitFeatureFlagsFromEnv, parseFitbitMasterFromEnv } from "@/lib/fitbit/config";

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

  return (
    <section className="flex flex-col gap-4" aria-labelledby="health-heading">
      <header className="flex flex-col gap-1">
        <h1 id="health-heading" className="text-xl font-semibold tracking-tight text-foreground">
          Salud
        </h1>
        {flags.uiEnabled ? (
          <p className="text-sm text-muted-foreground">
            Telemetría diaria desde Supabase (<span className="font-mono text-foreground">telemetria_diaria</span>).
            Ventana de {VENTANA_DIAS} días en UTC. Requiere{" "}
            <code className="rounded bg-muted px-1 text-foreground">FITBIT_ACTIVO=true|1</code> (maestro) y{" "}
            <code className="rounded bg-muted px-1 text-foreground">NEXT_PUBLIC_FITBIT_UI_ENABLED</code>; sync:{" "}
            <code className="rounded bg-muted px-1 text-foreground">FITBIT_SYNC_ENABLED</code> o, si está vacío, el
            mismo criterio sobre <code className="rounded bg-muted px-1 text-foreground">FITBIT_ACTIVO</code>.
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
                <code className="rounded bg-muted px-1 text-foreground">apps/web/.env.local</code> (Vercel: variables de{" "}
                <span className="font-mono text-foreground">apps/web</span>).
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
        <HealthTelemetriaPanel fechas={fechas} syncEnabled={flags.syncEnabled} result={telemetria} />
      )}
    </section>
  );
}
