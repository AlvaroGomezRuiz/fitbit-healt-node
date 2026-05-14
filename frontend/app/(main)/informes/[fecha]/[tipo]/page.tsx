import Link from "next/link";
import * as React from "react";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ReporteHtmlIframeSandbox } from "@/components/features/informes/reporte-html-iframe-sandbox";
import { addDaysIsoUtc } from "@/lib/data/date-madrid";
import { fetchReporteHtmlByFechaYTipo } from "@/lib/data/reportes-html";
import { reporteHtmlTipoFromSlug, reporteHtmlTipoLabelsEs, reporteHtmlTipoToSlug } from "@/lib/informes/reporte-tipo-slug";

export const dynamic = "force-dynamic";

interface InformesVerPageProps {
  readonly params: Promise<{ readonly fecha: string; readonly tipo: string }>;
}

export default async function InformesVerPage(props: InformesVerPageProps): Promise<React.ReactElement> {
  const { fecha, tipo: slug } = await props.params;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(fecha)) {
    notFound();
  }
  const tipo = reporteHtmlTipoFromSlug(slug);
  if (tipo === null) {
    notFound();
  }

  const result = await fetchReporteHtmlByFechaYTipo({ fecha, tipo });
  if (!result.ok) {
    return (
      <section className="flex flex-col gap-3" aria-labelledby="informe-error-heading">
        <h1 id="informe-error-heading" className="text-lg font-semibold text-destructive">
          No se pudo cargar el informe
        </h1>
        <p className="text-sm text-muted-foreground">{result.message}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/informes?fecha=${fecha}`} prefetch={false}>
            Volver al hub
          </Link>
        </Button>
      </section>
    );
  }
  if (result.row === null || result.row.html_content.trim().length === 0) {
    notFound();
  }

  const row = result.row;
  const prev = addDaysIsoUtc(fecha, -1);
  const next = addDaysIsoUtc(fecha, 1);
  const slugSelf = reporteHtmlTipoToSlug(tipo);
  const title = `${reporteHtmlTipoLabelsEs(tipo)} · ${fecha}`;

  return (
    <article className="flex flex-col gap-4" aria-labelledby="informe-html-heading">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 id="informe-html-heading" className="text-xl font-semibold tracking-tight text-foreground">
            {reporteHtmlTipoLabelsEs(tipo)}
          </h1>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/informes?fecha=${fecha}`} prefetch={false}>
              Hub informes
            </Link>
          </Button>
        </div>
        <p className="font-mono text-sm text-muted-foreground">{fecha}</p>
        <p className="text-xs text-muted-foreground">
          Archivo: <span className="text-foreground">{row.nombre_archivo}</span> · iframe sandbox (sin scripts en este
          documento).
        </p>
        <nav className="flex flex-wrap gap-2" aria-label="Mismo tipo, día anterior o siguiente">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/informes/${prev}/${slugSelf}`} prefetch={false}>
              Ayer ({prev})
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/informes/${next}/${slugSelf}`} prefetch={false}>
              Mañana ({next})
            </Link>
          </Button>
        </nav>
      </header>
      <ReporteHtmlIframeSandbox html={row.html_content} title={title} />
    </article>
  );
}
