"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isSundayEuropeMadrid } from "@/lib/data/date-madrid";
import type { HomeDashboardPayload } from "@/lib/data/home-dashboard";

import { HomeDashboardActividad } from "@/components/features/home-dashboard-actividad";
import { HomeDashboardResumen } from "@/components/features/home-dashboard-resumen";
import { HomePillarCards } from "@/components/features/home-pillar-cards";
import { InicioDomingoPesoForm } from "@/components/features/inicio/inicio-domingo-peso-form";
import { InicioProfileStrip } from "@/components/features/inicio/inicio-profile-strip";
import { InicioWeeklyObjectivesStrip } from "@/components/features/inicio/inicio-weekly-objectives-strip";

interface HomeDashboardViewProps {
  readonly dashboard: HomeDashboardPayload;
}

function defaultPesoDomingoText(dashboard: HomeDashboardPayload): string {
  if (dashboard.biometria.state !== "ok") {
    return "";
  }
  return String(dashboard.biometria.data.peso_kg).replace(".", ",");
}

export function HomeDashboardView({ dashboard }: HomeDashboardViewProps): React.ReactElement {
  const domingoMadrid = isSundayEuropeMadrid(dashboard.meta.fechaCivilMadrid);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Inicio</h1>
        <p className="text-sm text-muted-foreground">
          Resumen en tres pilares: nutrición, entrenador y salud. Usa las pestañas y enlaces para profundizar en cada
          área.
        </p>
      </header>
      <InicioProfileStrip biometria={dashboard.biometria} />
      <InicioWeeklyObjectivesStrip block={dashboard.weeklyObjective} />
      {domingoMadrid && dashboard.meta.usuarioAutenticado ? (
        <section
          className="rounded-lg border border-border bg-card px-4 py-3 text-card-foreground"
          aria-labelledby="domingo-peso-heading"
        >
          <h2 id="domingo-peso-heading" className="text-sm font-semibold text-foreground">
            Peso domingo (ayunas)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ventana de registro: domingo hasta las 14:00 (Madrid). Escribe en la fila única de biometría.
          </p>
          <div className="mt-3">
            <InicioDomingoPesoForm
              ventanaActiva={dashboard.meta.showDomingoPesoVentana}
              usuarioAutenticado={dashboard.meta.usuarioAutenticado}
              defaultPesoText={defaultPesoDomingoText(dashboard)}
            />
          </div>
        </section>
      ) : null}
      <HomePillarCards dashboard={dashboard} />
      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="w-full" aria-label="Secciones del panel">
          <TabsTrigger className="flex-1" value="resumen">
            Resumen
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="actividad">
            Actividad
          </TabsTrigger>
        </TabsList>
        <TabsContent value="resumen">
          <HomeDashboardResumen dashboard={dashboard} />
        </TabsContent>
        <TabsContent value="actividad">
          <HomeDashboardActividad dashboard={dashboard} />
        </TabsContent>
      </Tabs>
      <details className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground dark:bg-muted/20">
        <summary className="cursor-pointer select-none font-medium text-foreground">
          Configuración (Fitbit / entorno)
        </summary>
        <ul className="mt-2 list-disc space-y-2 pl-4 marker:text-muted-foreground">
          <li>
            Telemetría visible en web: define{" "}
            <code className="rounded bg-muted px-1 font-mono text-foreground">FITBIT_ACTIVO=true</code> (o{" "}
            <code className="rounded bg-muted px-1 font-mono text-foreground">1</code>) y{" "}
            <code className="rounded bg-muted px-1 font-mono text-foreground">NEXT_PUBLIC_FITBIT_UI_ENABLED=true</code>{" "}
            en Vercel u otro host.
          </li>
          <li>
            Los datos de pulsera se leen del resumen diario guardado (última lectura por fecha).
          </li>
        </ul>
      </details>
    </div>
  );
}
