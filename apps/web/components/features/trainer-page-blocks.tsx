import * as React from "react";

import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import {
  previewLineForEntrenoHistoricoRow,
  type EntrenoHistoricoListRow,
  type ListEntrenosHistoricoRecentResult,
} from "@/lib/data/entrenos-historico";
import { textPreviewFromHtml } from "@/lib/data/html-preview";
import type { ListReportesHtmlRecentResult } from "@/lib/data/reportes-html";
import { cn } from "@/lib/utils";

function truncateUiPreview(text: string, maxLen: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  const cap = Number.isFinite(maxLen) && maxLen > 8 ? Math.floor(maxLen) : 120;
  if (collapsed.length <= cap) {
    return collapsed;
  }
  return `${collapsed.slice(0, cap)}…`;
}

function origenEtiqueta(origen: EntrenoHistoricoListRow["origen"]): string {
  switch (origen) {
    case "lyfta_raw":
      return "Lyfta";
    case "drive_csv":
      return "Drive (CSV)";
    default: {
      const exhaustivo: never = origen;
      return exhaustivo;
    }
  }
}

interface PostEntrenoTrainerBlockProps {
  readonly reportes: ListReportesHtmlRecentResult;
}

export function PostEntrenoTrainerBlock(props: PostEntrenoTrainerBlockProps): React.ReactElement {
  const { reportes } = props;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Post-entreno</h2>
      <p className="text-xs text-muted-foreground">
        Informe post-entreno: ventana ~14:30 Madrid (pendiente de cron dedicado en{" "}
        <code className="rounded bg-muted px-1 font-mono text-foreground">vercel.json</code>). Detalle de estado y
        crons: <code className="rounded bg-muted px-1 font-mono text-foreground">docs/ESTADO-PROYECTO.md</code>.
      </p>
      {reportes.ok === false ? (
        <EmptyNote>{friendlyQueryMessage(reportes.message)}</EmptyNote>
      ) : reportes.rows.length === 0 ? (
        <EmptyNote>
          Aún no hay informes <span className="font-mono text-foreground">POST_ENTRENO</span> en{" "}
          <span className="font-mono text-foreground">reportes_html</span>. Cuando el cron dedicado esté activo,
          aparecerán aquí los últimos HTML generados (fechas civiles Madrid).
        </EmptyNote>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Informes post-entreno recientes">
          {reportes.rows.map((r) => (
            <li
              key={r.id}
              className={cn(
                "rounded-md border border-border bg-background/60 px-3 py-2 text-xs",
                "text-foreground",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{r.fecha}</span>
                <span className="text-muted-foreground">POST ENTRENO</span>
              </div>
              <p className="mt-1 line-clamp-3 text-muted-foreground">
                {textPreviewFromHtml(r.html_content, 200)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface EntrenosHistorialTrainerBlockProps {
  readonly historial: ListEntrenosHistoricoRecentResult;
}

export function EntrenosHistorialTrainerBlock(props: EntrenosHistorialTrainerBlockProps): React.ReactElement {
  const { historial } = props;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Historial de entrenos</h2>
      <p className="text-xs text-muted-foreground">
        Últimas sesiones en <span className="font-mono text-foreground">entrenos_historico</span> (solo lectura;
        incluye Lyfta y migración Drive cuando RLS lo permita).
      </p>
      {historial.ok === false ? (
        <div
          className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <p className="font-medium">Error al cargar el historial</p>
          <p className="mt-1 text-muted-foreground">{friendlyQueryMessage(historial.message)}</p>
        </div>
      ) : historial.rows.length === 0 ? (
        <EmptyNote>No hay filas visibles todavía.</EmptyNote>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Historial de entrenos reciente">
          {historial.rows.map((row) => {
            const preview = truncateUiPreview(previewLineForEntrenoHistoricoRow(row), 140);
            return (
              <li
                key={row.id}
                className={cn(
                  "rounded-md border border-border bg-background/60 px-3 py-2 text-xs",
                  "text-foreground",
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <time className="font-mono font-medium text-foreground" dateTime={row.session_date}>
                    {row.session_date}
                  </time>
                  <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-muted-foreground">
                    {origenEtiqueta(row.origen)}
                  </span>
                </div>
                <p className="mt-1 font-medium text-foreground">{row.session_title}</p>
                {preview.length > 0 ? (
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{preview}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
