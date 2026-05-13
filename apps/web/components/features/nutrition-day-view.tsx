import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { addDaysIsoUtc } from "@/lib/data/date-madrid";
import type { BiometriaMaestroRow } from "@/lib/data/biometria-maestro";
import type { NutritionDayPayload } from "@/lib/data/nutrition-day";

import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import { NutritionShoppingSunday } from "@/components/features/nutrition-shopping-sunday";

interface NutritionDayViewProps {
  readonly payload: NutritionDayPayload;
}

function formatObjetivoTipoNutricion(tipo: BiometriaMaestroRow["objetivo_tipo"]): string {
  switch (tipo) {
    case "CUTTING_AGRESIVO":
      return "Cutting agresivo";
    case "CUTTING_SUAVE":
      return "Cutting suave";
    case "MANTENIMIENTO":
      return "Mantenimiento";
    case "VOLUMEN_LIMPIO":
      return "Volumen limpio";
    case "VOLUMEN_AGRESIVO":
      return "Volumen agresivo";
  }
}

function objetivosSemanalesResumen(bio: BiometriaMaestroRow): string {
  return `${formatObjetivoTipoNutricion(bio.objetivo_tipo)} · ${bio.kcal_target} kcal/día · P ${bio.proteina_g} g · C ${bio.carbos_g} g · G ${bio.grasa_g} g (se editan en Perfil Personal).`;
}

export function NutritionDayView({ payload }: NutritionDayViewProps): React.ReactElement {
  const prev = addDaysIsoUtc(payload.fecha, -1);
  const next = addDaysIsoUtc(payload.fecha, 1);
  return (
    <section className="flex flex-col gap-4" aria-labelledby="nutrition-heading">
      <header className="flex flex-col gap-2">
        <h1 id="nutrition-heading" className="text-xl font-semibold tracking-tight text-foreground">
          Nutrición
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Plan del día (IA) guardado en tu diario, objetivos desde Perfil Personal, lista de compra y menú semanal.
          <br />
          La telemetría de pulsera está en Salud, no en esta pantalla.
        </p>
        <nav className="flex items-center justify-between gap-2" aria-label="Cambiar día">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/nutrition?fecha=${prev}`} prefetch={false}>
              Día anterior
            </Link>
          </Button>
          <p className="text-sm font-medium text-foreground">{payload.fecha}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/nutrition?fecha=${next}`} prefetch={false}>
              Día siguiente
            </Link>
          </Button>
        </nav>
      </header>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Objetivos semanales personales</h2>
        {payload.biometria.state === "ok" ? (
          <p className="text-sm leading-relaxed text-foreground">{objetivosSemanalesResumen(payload.biometria.data)}</p>
        ) : payload.biometria.state === "empty" ? (
          <EmptyNote>
            Sin Perfil Personal visible. Si la fila existe en Supabase pero no aquí, revisa RLS anon SELECT al
            singleton o inicia sesión.
          </EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(payload.biometria.message)}</EmptyNote>
        )}
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Plan del día (IA)</h2>
        <p className="text-xs text-muted-foreground">
          El cron <code className="rounded bg-muted px-1 text-foreground">daily-nutrition-routine</code> en Vercel
          está a las <span className="font-medium text-foreground">07:50 UTC</span> cada día (~08:50 en invierno o
          ~09:50 en verano en Madrid, según horario de verano).
        </p>
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          <li>Perfil Personal (peso, objetivo, macros)</li>
          <li>Rutina oficial del día civil en Madrid</li>
          <li>Telemetría de ayer (pulsera), si hay fila válida</li>
          <li>Entrenos recientes en formato compacto</li>
          <li>Salida en markdown guardada en la tabla diario_plan_ia para la fecha Madrid</li>
        </ul>
        {payload.diarioPlanIa.state === "ok" ? (
          <div
            className="max-h-[min(70vh,720px)] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground"
            role="article"
          >
            {payload.diarioPlanIa.data.markdown}
          </div>
        ) : payload.diarioPlanIa.state === "empty" ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay plan para esta fecha; tras la pasada del cron debería crearse la fila del día.
          </p>
        ) : (
          <EmptyNote>{friendlyQueryMessage(payload.diarioPlanIa.message)}</EmptyNote>
        )}
      </div>
      <NutritionShoppingSunday payload={payload} />
    </section>
  );
}
