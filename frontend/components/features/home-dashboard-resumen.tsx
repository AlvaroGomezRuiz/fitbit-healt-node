import Link from "next/link";
import * as React from "react";

import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import {
  emptyDashboardBiometria,
  emptySavedNotesLines,
  sectionSavedNotesTitle,
} from "@/lib/ui/single-user-placeholders";
import { textPreviewFromHtml } from "@/lib/data/html-preview";
import type { HomeDashboardPayload } from "@/lib/data/home-dashboard";
import { buildMemoriaDisplayEntries } from "@/lib/data/memoria-line-display";
import { markdownPlainPreviewLines } from "@/lib/data/markdown-plain-preview";
import { cn } from "@/lib/utils";

const REPORTE_PLAIN_MAX = 400;

interface HomeDashboardResumenProps {
  readonly dashboard: HomeDashboardPayload;
}

export function HomeDashboardResumen({ dashboard }: HomeDashboardResumenProps): React.ReactElement {
  const memoriaEntries =
    dashboard.memoriaLines.state === "ok" ? buildMemoriaDisplayEntries(dashboard.memoriaLines.data, 240) : [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm text-card-foreground">
      <section aria-labelledby="nutri-resumen-title" className="flex flex-col gap-2">
        <h2 id="nutri-resumen-title" className="text-sm font-semibold text-foreground">
          Nutrición del día
        </h2>
        <div className="rounded-md border border-border bg-background/60 px-3 py-2 text-xs sm:text-sm">
          {dashboard.diarioPlanHoy.state === "ok" ? (
            <p className="leading-snug text-foreground">{markdownPlainPreviewLines(dashboard.diarioPlanHoy.data.markdown, 320)}</p>
          ) : dashboard.diarioPlanHoy.state === "no_plan" ? (
            <p className="text-muted-foreground">Aún no hay plan del día publicado.</p>
          ) : (
            <EmptyNote>{friendlyQueryMessage(dashboard.diarioPlanHoy.message)}</EmptyNote>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Perfil Personal</h3>
          {dashboard.biometria.state === "ok" ? (
            <ul className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
              <li className="text-muted-foreground">Peso (último)</li>
              <li className="text-right font-medium text-foreground">
                {dashboard.biometria.data.peso_kg} kg · {dashboard.biometria.data.fecha_ultimo_pesaje}
              </li>
              <li className="text-muted-foreground">IMC</li>
              <li className="text-right font-medium text-foreground">{dashboard.biometria.data.imc}</li>
              <li className="text-muted-foreground">Objetivo</li>
              <li className="text-right font-medium text-foreground">
                {dashboard.biometria.data.objetivo_tipo.replaceAll("_", " ")}
              </li>
              <li className="text-muted-foreground">Kcal / P / C / G</li>
              <li className="text-right font-medium text-foreground">
                {dashboard.biometria.data.kcal_target} · {dashboard.biometria.data.proteina_g}g ·{" "}
                {dashboard.biometria.data.carbos_g}g · {dashboard.biometria.data.grasa_g}g
              </li>
            </ul>
          ) : dashboard.biometria.state === "empty" ? (
            <EmptyNote>{emptyDashboardBiometria}</EmptyNote>
          ) : (
            <EmptyNote>{friendlyQueryMessage(dashboard.biometria.message)}</EmptyNote>
          )}
          <p className="text-xs text-muted-foreground">Los valores se actualizan con tus reportes semanales de peso.</p>
        </div>
        <Link
          className="text-xs font-medium text-ring underline-offset-4 hover:underline"
          href="/nutrition"
        >
          Ver en nutrición
        </Link>
      </section>

      <section aria-labelledby="train-resumen-title" className="flex flex-col gap-2 border-t border-border pt-3">
        <h2 id="train-resumen-title" className="text-sm font-semibold text-foreground">
          Entrenamiento
        </h2>
        <div className="flex flex-col gap-2">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">Pre-entreno del día</h3>
            {dashboard.preEntrenoHoy.state === "ok" ? (
              <p className="mt-1 text-xs leading-relaxed text-foreground sm:text-sm">
                {textPreviewFromHtml(dashboard.preEntrenoHoy.data.html_content, REPORTE_PLAIN_MAX)}
              </p>
            ) : dashboard.preEntrenoHoy.state === "empty" ? (
              <p className="mt-1 text-xs text-muted-foreground">Aún no hay pre-entreno generado para hoy.</p>
            ) : (
              <EmptyNote>{friendlyQueryMessage(dashboard.preEntrenoHoy.message)}</EmptyNote>
            )}
          </div>
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">Post-entreno</h3>
            {dashboard.postEntrenoHoy.state === "ok" ? (
              <p className="mt-1 text-xs leading-relaxed text-foreground sm:text-sm">
                {textPreviewFromHtml(dashboard.postEntrenoHoy.data.html_content, REPORTE_PLAIN_MAX)}
              </p>
            ) : dashboard.postEntrenoHoy.state === "empty" ? (
              <p className="mt-1 text-xs text-muted-foreground">Aún no generado.</p>
            ) : (
              <EmptyNote>{friendlyQueryMessage(dashboard.postEntrenoHoy.message)}</EmptyNote>
            )}
          </div>
        </div>
        <Link
          className="text-xs font-medium text-ring underline-offset-4 hover:underline"
          href="/trainer"
        >
          Ver en entrenador
        </Link>
      </section>

      <section aria-labelledby="tele-card-title" className="flex flex-col gap-2 border-t border-border pt-3">
        <h2 id="tele-card-title" className="text-sm font-semibold text-foreground">
          Telemetría
        </h2>
        {dashboard.telemetriaLatest.state === "ok" ? (
          <ul className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
            <li className="text-muted-foreground">Fecha</li>
            <li className="text-right font-medium text-foreground">{dashboard.telemetriaLatest.data.fecha}</li>
            <li className="text-muted-foreground">Sueño (h)</li>
            <li className="text-right font-medium text-foreground">
              {dashboard.telemetriaLatest.data.sueno_horas ?? "—"}
            </li>
            <li className="text-muted-foreground">Pasos</li>
            <li className="text-right font-medium text-foreground">
              {dashboard.telemetriaLatest.data.pasos ?? "—"}
            </li>
            <li className="text-muted-foreground">Pulsera activa</li>
            <li className="text-right font-medium text-foreground">
              {dashboard.telemetriaLatest.data.pulsera_activa ? "Sí" : "No"}
            </li>
          </ul>
        ) : dashboard.telemetriaLatest.state === "disabled" ? (
          <EmptyNote>
            Cuando actives la telemetría en esta app, aquí verás pasos, sueño y señales de la pulsera. Mientras tanto
            puedes seguir con nutrición y entrenador.
          </EmptyNote>
        ) : dashboard.telemetriaLatest.state === "empty" ? (
          <EmptyNote>
            Sin datos de pulsera todavía. Cuando sincronices, aparecerá un resumen amable con pasos y descanso.
          </EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(dashboard.telemetriaLatest.message)}</EmptyNote>
        )}
      </section>

      <section aria-labelledby="mem-card-title" className="flex flex-col gap-2 border-t border-border pt-3">
        <h2 id="mem-card-title" className="text-sm font-semibold text-foreground">
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
                  className={cn(
                    "rounded-md border border-border bg-background/60 px-3 py-2 text-xs",
                    "text-muted-foreground",
                  )}
                >
                  <span className="font-medium text-foreground">{entry.sourceShort}</span>
                  <p className="mt-1 text-foreground/90">{entry.line}</p>
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
