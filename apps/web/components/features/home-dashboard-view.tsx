"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HomeDashboardPayload } from "@/lib/data/home-dashboard";

import { HomeDashboardActividad } from "@/components/features/home-dashboard-actividad";
import { HomeDashboardResumen } from "@/components/features/home-dashboard-resumen";

interface HomeDashboardViewProps {
  readonly dashboard: HomeDashboardPayload;
}

export function HomeDashboardView({ dashboard }: HomeDashboardViewProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Inicio</h1>
        <p className="text-sm text-muted-foreground">
          Resumen en vivo desde Supabase (fase 1). Si falta configuración o RLS bloquea la lectura, verás un
          aviso explícito.
        </p>
      </header>
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
    </div>
  );
}
