import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { addDaysIsoUtc, todayMadridIso } from "@/lib/data/date-madrid";
import { cn } from "@/lib/utils";
import { fetchReporteHtmlByFechaYTipo, listReportesHtmlRecent, type ReporteHtmlTipo } from "@/lib/data/reportes-html";
import { reporteHtmlTipoLabelsEs, reporteHtmlTipoToSlug } from "@/lib/informes/reporte-tipo-slug";

export const dynamic = "force-dynamic";

interface InformesHubPageProps {
  readonly searchParams?: Promise<{ readonly fecha?: string }>;
}

function parseFecha(raw: string | undefined): string {
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  return todayMadridIso();
}

const TIPOS_ORDEN: readonly ReporteHtmlTipo[] = ["PRE_ENTRENO", "POST_ENTRENO", "RESUMEN_NOCHE"];

export default async function InformesHubPage(props: InformesHubPageProps): Promise<React.ReactElement> {
  const sp = props.searchParams !== undefined ? await props.searchParams : {};
  const fecha = parseFecha(sp.fecha);
  const prev = addDaysIsoUtc(fecha, -1);
  const next = addDaysIsoUtc(fecha, 1);

  const [recent, pre, post, resumenNoche] = await Promise.all([
    listReportesHtmlRecent({ limit: 45 }),
    fetchReporteHtmlByFechaYTipo({ fecha, tipo: "PRE_ENTRENO" }),
    fetchReporteHtmlByFechaYTipo({ fecha, tipo: "POST_ENTRENO" }),
    fetchReporteHtmlByFechaYTipo({ fecha, tipo: "RESUMEN_NOCHE" }),
  ]);

  const porTipo: readonly [
    typeof pre,
    typeof post,
    typeof resumenNoche,
  ] = [pre, post, resumenNoche];

  const fechasCalendario: readonly string[] = ((): readonly string[] => {
    if (!recent.ok) {
      return [];
    }
    const set = new Set<string>();
    for (const r of recent.rows) {
      if (/^\d{4}-\d{2}-\d{2}$/u.test(r.fecha)) {
        set.add(r.fecha);
      }
    }
    return Array.from(set).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, 14);
  })();

  return (
    <section className="flex flex-col gap-4" aria-labelledby="informes-heading">
      <header className="flex flex-col gap-2">
        <h1 id="informes-heading" className="text-xl font-semibold tracking-tight text-foreground">
          Informes
        </h1>
        <p className="text-sm text-muted-foreground">
          HTML guardado en base de datos (solo lectura). El visor usa un iframe con sandbox estricto para mitigar XSS.
        </p>
        <nav className="flex flex-wrap items-center justify-between gap-2" aria-label="Cambiar día del informe">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/informes?fecha=${prev}`} prefetch={false}>
              Día anterior
            </Link>
          </Button>
          <p className="text-sm font-medium text-foreground">{fecha}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/informes?fecha=${next}`} prefetch={false}>
              Día siguiente
            </Link>
          </Button>
        </nav>
      </header>

      {fechasCalendario.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Días con informes</h2>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Atajos por fecha">
            {fechasCalendario.map((d) => {
              const active = d === fecha;
              return (
                <li key={d}>
                  <Link
                    href={`/informes?fecha=${d}`}
                    prefetch={false}
                    className={cn(
                      "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border px-2 py-1 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      active
                        ? "border-ring bg-muted font-medium text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {d}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Tipos para esta fecha</h2>
        <ul className="flex flex-col gap-2">
          {TIPOS_ORDEN.map((tipo, idx) => {
            const res = porTipo[idx];
            const slug = reporteHtmlTipoToSlug(tipo);
            const label = reporteHtmlTipoLabelsEs(tipo);
            const has =
              res !== undefined && res.ok === true && res.row !== null && res.row !== undefined && res.row.html_content.trim().length > 0;
            return (
              <li key={tipo} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  {has ? (
                    <Button variant="default" size="sm" asChild>
                      <Link href={`/informes/${fecha}/${slug}`} prefetch={false}>
                        Ver HTML
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin informe para este día.</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {!recent.ok ? (
        <p className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          No se pudo cargar el calendario de fechas: {recent.message}
        </p>
      ) : null}
    </section>
  );
}
