import Link from "next/link";
import * as React from "react";

import { textPreviewFromHtml } from "@/lib/data/html-preview";
import type { HomeDashboardPayload } from "@/lib/data/home-dashboard";
import { buildMemoriaDisplayEntries } from "@/lib/data/memoria-line-display";
import { cn } from "@/lib/utils";

import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import {
  emptyDailyReportsRecent,
  emptyImportedTrainingSessions,
  emptySavedNotesLines,
  sectionDailyReportsTitle,
  sectionSavedNotesTitle,
} from "@/lib/ui/single-user-placeholders";

interface HomeDashboardActividadProps {
  readonly dashboard: HomeDashboardPayload;
}

export function HomeDashboardActividad({ dashboard }: HomeDashboardActividadProps): React.ReactElement {
  const memoriaEntries =
    dashboard.memoriaLines.state === "ok" ? buildMemoriaDisplayEntries(dashboard.memoriaLines.data.slice(0, 4), 200) : [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm text-card-foreground">
      <section aria-labelledby="act-card-title" className="flex flex-col gap-2">
        <h2 id="act-card-title" className="text-sm font-semibold text-foreground">
          Última sesión
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
          <EmptyNote>{emptyImportedTrainingSessions}</EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(dashboard.ultimaSesion.message)}</EmptyNote>
        )}
      </section>
      <section aria-labelledby="rep-recent-title" className="flex flex-col gap-2 border-t border-border pt-3">
        <h2 id="rep-recent-title" className="text-sm font-semibold text-foreground">
          {sectionDailyReportsTitle}
        </h2>
        {dashboard.reportes.state === "ok" ? (
          <ul className="flex flex-col gap-2">
            {dashboard.reportes.data.slice(0, 3).map((r) => (
              <li
                key={r.id}
                className={cn(
                  "rounded-md border border-border bg-background/60 px-3 py-2 text-xs",
                  "text-foreground",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{r.fecha}</span>
                  <span className="text-muted-foreground">{r.tipo.replaceAll("_", " ")}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-muted-foreground">{textPreviewFromHtml(r.html_content, 140)}</p>
              </li>
            ))}
          </ul>
        ) : dashboard.reportes.state === "empty" ? (
          <EmptyNote>{emptyDailyReportsRecent}</EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(dashboard.reportes.message)}</EmptyNote>
        )}
      </section>
      <section aria-labelledby="mem-recent-title" className="flex flex-col gap-2 border-t border-border pt-3">
        <h2 id="mem-recent-title" className="text-sm font-semibold text-foreground">
          {sectionSavedNotesTitle}
        </h2>
        {dashboard.memoriaLines.state === "ok" ? (
          memoriaEntries.length === 0 ? (
            <EmptyNote>{emptySavedNotesLines}</EmptyNote>
          ) : (
            <ul className="flex flex-col gap-2">
              {memoriaEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-md border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{entry.sourceShort}</span>
                  <p className="mt-1 line-clamp-3 text-foreground/90">{entry.line}</p>
                </li>
              ))}
            </ul>
          )
        ) : dashboard.memoriaLines.state === "empty" ? (
          <EmptyNote>{emptySavedNotesLines}</EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(dashboard.memoriaLines.message)}</EmptyNote>
        )}
      </section>
    </div>
  );
}
