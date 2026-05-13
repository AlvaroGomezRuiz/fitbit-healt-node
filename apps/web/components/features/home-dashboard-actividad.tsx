import Link from "next/link";
import * as React from "react";

import type { HomeDashboardPayload } from "@/lib/data/home-dashboard";

import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";

interface HomeDashboardActividadProps {
  readonly dashboard: HomeDashboardPayload;
}

export function HomeDashboardActividad({ dashboard }: HomeDashboardActividadProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm text-card-foreground">
      <section aria-labelledby="act-card-title" className="flex flex-col gap-2">
        <h2 id="act-card-title" className="text-sm font-semibold text-foreground">
          Última sesión (`entrenos_historico`)
        </h2>
        {dashboard.ultimaSesion.state === "ok" ? (
          <div className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm">
            <p className="font-medium text-foreground">{dashboard.ultimaSesion.data.session_date}</p>
            <p className="text-muted-foreground">{dashboard.ultimaSesion.data.session_title || "Sin título"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Origen: {dashboard.ultimaSesion.data.origen}</p>
            <Link
              className="mt-2 inline-block text-xs font-medium text-ring underline-offset-4 hover:underline"
              href="/trainer"
            >
              Ir a entrenador
            </Link>
          </div>
        ) : dashboard.ultimaSesion.state === "empty" ? (
          <EmptyNote>No hay filas de entreno importadas.</EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(dashboard.ultimaSesion.message)}</EmptyNote>
        )}
      </section>
    </div>
  );
}
