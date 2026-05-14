import Link from "next/link";
import * as React from "react";

import { friendlyQueryMessage } from "@/components/features/home/query-message";
import { markdownPlainPreviewLines } from "@/lib/data/markdown-plain-preview";
import type { HomeDashboardPayload } from "@/lib/data/home-dashboard";
import {
  emptyTelemetryPillarSummary,
  pillarNoNutritionPlanYet,
} from "@/lib/ui/single-user-placeholders";

interface HomePillarCardsProps {
  readonly dashboard: HomeDashboardPayload;
}

function formatObjetivoNutricion(tipo: string): string {
  const map: Readonly<Record<string, string>> = {
    CUTTING_AGRESIVO: "deficit marcado",
    CUTTING_SUAVE: "deficit suave",
    MANTENIMIENTO: "mantenimiento",
    VOLUMEN_LIMPIO: "volumen limpio",
    VOLUMEN_AGRESIVO: "volumen agresivo",
  };
  return map[tipo] ?? tipo.replaceAll("_", " ").toLowerCase();
}

function formatGrupoSesion(grupo: string): string {
  const map: Readonly<Record<string, string>> = {
    PUSH: "empuje",
    PULL: "tirón",
    LEG: "pierna",
    DESCANSO: "descanso",
  };
  return map[grupo] ?? grupo.toLowerCase();
}

function formatNumberEs(value: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value);
}

export function HomePillarCards({ dashboard }: HomePillarCardsProps): React.ReactElement {
  const { meta, diarioPlanHoy, biometria, ultimaSesion, entrenos7dCount, rutinaHoy, telemetriaLatest } =
    dashboard;

  const nutricionPlanLine =
    diarioPlanHoy.state === "ok"
      ? markdownPlainPreviewLines(diarioPlanHoy.data.markdown, 180)
      : diarioPlanHoy.state === "no_plan"
        ? pillarNoNutritionPlanYet
        : friendlyQueryMessage(diarioPlanHoy.message);

  const nutricionMacroLine: string | null =
    biometria.state === "ok"
      ? `${formatObjetivoNutricion(biometria.data.objetivo_tipo)} · ${formatNumberEs(
          biometria.data.kcal_target,
        )} kcal · P ${formatNumberEs(biometria.data.proteina_g)} / C ${formatNumberEs(
          biometria.data.carbos_g,
        )} / G ${formatNumberEs(biometria.data.grasa_g)} g`
      : biometria.state === "empty"
        ? null
        : friendlyQueryMessage(biometria.message);

  const coachSesionLine =
    ultimaSesion.state === "ok"
      ? `Última sesión: ${ultimaSesion.data.session_date} · ${ultimaSesion.data.session_title || "Sin título"}.`
      : ultimaSesion.state === "empty"
        ? "Aún no hay sesiones importadas."
        : friendlyQueryMessage(ultimaSesion.message);

  const coach7dLine =
    entrenos7dCount.state === "ok"
      ? `${entrenos7dCount.count} sesión(es) registradas en los últimos 7 días.`
      : friendlyQueryMessage(entrenos7dCount.message);

  const coachRutinaLine =
    rutinaHoy.state === "ok"
      ? `Rutina hoy (${rutinaHoy.data.nombre_dia}): ${formatGrupoSesion(rutinaHoy.data.grupo_sesion)}.`
      : rutinaHoy.state === "empty"
        ? "Sin entrada de rutina oficial para hoy."
        : friendlyQueryMessage(rutinaHoy.message);

  const saludLine =
    telemetriaLatest.state === "ok"
      ? `Último día con datos (${telemetriaLatest.data.fecha}): ${telemetriaLatest.data.pasos !== null ? `${formatNumberEs(telemetriaLatest.data.pasos)} pasos` : "pasos —"} · ${
          telemetriaLatest.data.sueno_horas !== null
            ? `${formatNumberEs(telemetriaLatest.data.sueno_horas)} h sueño`
            : "sueño —"
        }.`
      : telemetriaLatest.state === "disabled"
        ? "Telemetría de pulsera desactivada. Actívala en Salud para ver pasos y sueño."
        : telemetriaLatest.state === "empty"
          ? emptyTelemetryPillarSummary
          : friendlyQueryMessage(telemetriaLatest.message);

  const pillarShell =
    "flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-sm";

  return (
    <div className="grid gap-3 md:grid-cols-3" aria-label="Resumen en tres pilares">
      <article className={pillarShell}>
        <h2 className="text-base font-semibold tracking-tight text-foreground">Nutrición</h2>
        <p className="text-xs capitalize text-muted-foreground">{meta.fechaCivilMadridLegible}</p>
        <p className="min-h-10 text-sm leading-snug text-foreground">{nutricionPlanLine}</p>
        {nutricionMacroLine !== null ? (
          <p className="text-xs leading-snug text-muted-foreground">{nutricionMacroLine}</p>
        ) : null}
        <Link
          className="mt-auto pt-1 text-sm font-medium text-ring underline-offset-4 hover:underline"
          href="/nutrition"
        >
          Ir a nutrición
        </Link>
      </article>
      <article className={pillarShell}>
        <h2 className="text-base font-semibold tracking-tight text-foreground">Entrenador</h2>
        <p className="min-h-10 text-sm leading-snug text-foreground">{coachSesionLine}</p>
        <p className="text-xs leading-snug text-muted-foreground">{coach7dLine}</p>
        <p className="text-xs leading-snug text-muted-foreground">{coachRutinaLine}</p>
        <Link
          className="mt-auto pt-1 text-sm font-medium text-ring underline-offset-4 hover:underline"
          href="/trainer"
        >
          Ir a entrenador
        </Link>
      </article>
      <article className={pillarShell}>
        <h2 className="text-base font-semibold tracking-tight text-foreground">Salud</h2>
        <p className="min-h-10 text-sm leading-snug text-foreground">{saludLine}</p>
        <Link
          className="mt-auto pt-1 text-sm font-medium text-ring underline-offset-4 hover:underline"
          href="/health"
        >
          Ir a salud
        </Link>
      </article>
    </div>
  );
}
