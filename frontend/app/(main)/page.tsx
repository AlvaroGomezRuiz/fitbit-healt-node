import Link from "next/link";
import * as React from "react";

import { HomeDashboardView } from "@/components/features/home-dashboard-view";
import { fetchHomeDashboard, type HomeDashboardPayload } from "@/lib/data/home-dashboard";
import { SINGLE_USER_PLACEHOLDERS } from "@/lib/ui/single-user-placeholders";

export const dynamic = "force-dynamic";

function isHomeDashboardColdStart(dashboard: HomeDashboardPayload): boolean {
  if (dashboard.biometria.state === "ok") {
    return false;
  }
  if (dashboard.reportes.state === "ok" && dashboard.reportes.data.length > 0) {
    return false;
  }
  if (dashboard.memoriaLines.state === "ok" && dashboard.memoriaLines.data.length > 0) {
    return false;
  }
  if (dashboard.ultimaSesion.state === "ok") {
    return false;
  }
  if (dashboard.diarioPlanHoy.state === "ok") {
    return false;
  }
  if (dashboard.entrenos7dCount.state === "ok" && dashboard.entrenos7dCount.count > 0) {
    return false;
  }
  if (dashboard.rutinaHoy.state === "ok") {
    return false;
  }
  if (dashboard.preEntrenoHoy.state === "ok") {
    return false;
  }
  if (dashboard.postEntrenoHoy.state === "ok") {
    return false;
  }
  if (dashboard.telemetriaLatest.state === "ok") {
    return false;
  }
  return true;
}

function HomeColdStartPanel(): React.ReactElement {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="home-cold-heading">
      <header className="flex flex-col gap-1">
        <h1 id="home-cold-heading" className="text-xl font-semibold tracking-tight text-foreground">
          {SINGLE_USER_PLACEHOLDERS.inicio.titulo}
        </h1>
        <p className="text-sm text-muted-foreground">{SINGLE_USER_PLACEHOLDERS.sinDatosAun}</p>
        <p className="text-sm text-muted-foreground">{SINGLE_USER_PLACEHOLDERS.inicio.vacio}</p>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="Ir a secciones">
        <Link
          href="/nutrition"
          className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60"
        >
          Nutrición
        </Link>
        <Link
          href="/trainer"
          className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60"
        >
          Entreno
        </Link>
        <Link
          href="/health"
          className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60"
        >
          Salud
        </Link>
      </nav>
    </section>
  );
}

export default async function HomePage(): Promise<React.ReactElement> {
  const dashboard = await fetchHomeDashboard();
  if (isHomeDashboardColdStart(dashboard)) {
    return <HomeColdStartPanel />;
  }
  return <HomeDashboardView dashboard={dashboard} />;
}
