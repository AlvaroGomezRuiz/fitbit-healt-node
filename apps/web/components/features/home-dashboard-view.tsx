"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HomeDashboardPayload } from "@/lib/data/home-dashboard";

import { HomeDashboardActividad } from "@/components/features/home-dashboard-actividad";
import { HomeDashboardResumen } from "@/components/features/home-dashboard-resumen";
import { HomePillarCards } from "@/components/features/home-pillar-cards";

interface HomeDashboardViewProps {
  readonly dashboard: HomeDashboardPayload;
}

export function HomeDashboardView({ dashboard }: HomeDashboardViewProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Inicio</h1>
        <p className="text-sm text-muted-foreground">
          Resumen en tres pilares (nutrición, entrenador, salud). Los datos salen de Supabase; si falta RLS o env,
          verás avisos en cada bloque.
        </p>
      </header>
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
            Tabla consultada: <span className="font-mono text-foreground">telemetria_diaria</span> (última fila por
            fecha).
          </li>
        </ul>
      </details>
    </div>
  );
}
