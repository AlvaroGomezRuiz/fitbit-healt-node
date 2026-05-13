import * as React from "react";

import { textPreviewFromHtml } from "@/lib/data/html-preview";
import type { HomeDashboardPayload } from "@/lib/data/home-dashboard";
import { cn } from "@/lib/utils";

import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";

interface HomeDashboardResumenProps {
  readonly dashboard: HomeDashboardPayload;
}

export function HomeDashboardResumen({ dashboard }: HomeDashboardResumenProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm text-card-foreground">
      <section aria-labelledby="bio-card-title" className="flex flex-col gap-2">
        <h2 id="bio-card-title" className="text-sm font-semibold text-foreground">
          Biometría maestra
        </h2>
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
          <EmptyNote>
            Sin biometría maestra visible. Si la fila existe en Supabase pero no aquí, suele ser RLS con clave anon
            sin SELECT (migración `anon_select_biometria_maestro_singleton`) o sesión no autenticada.
          </EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(dashboard.biometria.message)}</EmptyNote>
        )}
      </section>
      <section aria-labelledby="tele-card-title" className="flex flex-col gap-2 border-t border-border pt-3">
        <h2 id="tele-card-title" className="text-sm font-semibold text-foreground">
          Telemetría (último día con datos)
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
            Telemetría de pulsera desactivada en este entorno. Abre la pestaña Salud o despliega el bloque
            «Configuración (Fitbit / entorno)» abajo del panel para ver las variables necesarias.
          </EmptyNote>
        ) : dashboard.telemetriaLatest.state === "empty" ? (
          <EmptyNote>No hay filas recientes en `telemetria_diaria`.</EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(dashboard.telemetriaLatest.message)}</EmptyNote>
        )}
      </section>
      <section aria-labelledby="rep-card-title" className="flex flex-col gap-2 border-t border-border pt-3">
        <h2 id="rep-card-title" className="text-sm font-semibold text-foreground">
          Informes IA (`reportes_html`)
        </h2>
        {dashboard.reportes.state === "ok" ? (
          <ul className="flex flex-col gap-2">
            {dashboard.reportes.data.map((r) => (
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
                <p className="mt-1 line-clamp-2 text-muted-foreground">
                  {textPreviewFromHtml(r.html_content, 180)}
                </p>
              </li>
            ))}
          </ul>
        ) : dashboard.reportes.state === "empty" ? (
          <EmptyNote>No hay informes HTML indexados todavía.</EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(dashboard.reportes.message)}</EmptyNote>
        )}
      </section>
      <section aria-labelledby="mem-card-title" className="flex flex-col gap-2 border-t border-border pt-3">
        <h2 id="mem-card-title" className="text-sm font-semibold text-foreground">
          Memoria IA (extracto)
        </h2>
        {dashboard.memoriaLines.state === "ok" ? (
          <ul className="flex flex-col gap-2">
            {dashboard.memoriaLines.data.map((m) => (
              <li
                key={m.id}
                className="rounded-md border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground"
              >
                <span className="font-medium text-foreground">{m.source_filename}</span>
                <p className="mt-1 whitespace-pre-wrap text-foreground/90">{m.contenido_linea}</p>
              </li>
            ))}
          </ul>
        ) : dashboard.memoriaLines.state === "empty" ? (
          <EmptyNote>No hay líneas en `memoria_ia`.</EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(dashboard.memoriaLines.message)}</EmptyNote>
        )}
      </section>
    </div>
  );
}
