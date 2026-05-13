import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { addDaysIsoUtc } from "@/lib/data/date-madrid";
import type { NutritionDayPayload } from "@/lib/data/nutrition-day";

import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import { NutritionShoppingSunday } from "@/components/features/nutrition-shopping-sunday";

interface NutritionDayViewProps {
  readonly payload: NutritionDayPayload;
  readonly isSundayMadrid: boolean;
}

export function NutritionDayView({ payload, isSundayMadrid }: NutritionDayViewProps): React.ReactElement {
  const prev = addDaysIsoUtc(payload.fecha, -1);
  const next = addDaysIsoUtc(payload.fecha, 1);
  return (
    <section className="flex flex-col gap-4" aria-labelledby="nutrition-heading">
      <header className="flex flex-col gap-2">
        <h1 id="nutrition-heading" className="text-xl font-semibold tracking-tight text-foreground">
          Nutrición
        </h1>
        <p className="text-sm text-muted-foreground">
          Vista día a día: objetivos desde `biometria_maestro` y telemetría diaria cuando exista fila para la
          fecha.
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
      {isSundayMadrid ? <NutritionShoppingSunday payload={payload} /> : null}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Objetivos y agua</h2>
        {payload.biometria.state === "ok" ? (
          <ul className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
            <li className="text-muted-foreground">Kcal objetivo</li>
            <li className="text-right font-medium">{payload.biometria.data.kcal_target}</li>
            <li className="text-muted-foreground">Proteína / Carbos / Grasas</li>
            <li className="text-right font-medium">
              {payload.biometria.data.proteina_g}g · {payload.biometria.data.carbos_g}g ·{" "}
              {payload.biometria.data.grasa_g}g
            </li>
            <li className="text-muted-foreground">Creatina</li>
            <li className="text-right font-medium">{payload.biometria.data.creatina_g} g</li>
            <li className="text-muted-foreground">Agua</li>
            <li className="text-right font-medium">{payload.biometria.data.agua_l} L</li>
            <li className="text-muted-foreground">Último recálculo</li>
            <li className="text-right font-medium">{payload.biometria.data.fecha_ultimo_recalculo}</li>
          </ul>
        ) : payload.biometria.state === "empty" ? (
          <EmptyNote>
            Sin biometría maestra visible. Si la fila existe en Supabase pero no aquí, revisa RLS anon SELECT al
            singleton o inicia sesión.
          </EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(payload.biometria.message)}</EmptyNote>
        )}
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Plan del día (IA)</h2>
        {payload.diarioPlanIa.state === "ok" ? (
          <div
            className="max-h-[min(70vh,720px)] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground"
            role="article"
          >
            {payload.diarioPlanIa.data.markdown}
          </div>
        ) : payload.diarioPlanIa.state === "empty" ? (
          <p className="text-sm text-muted-foreground">
            El plan del día se genera sobre las 8:50 (ver cron).
          </p>
        ) : (
          <EmptyNote>{friendlyQueryMessage(payload.diarioPlanIa.message)}</EmptyNote>
        )}
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Telemetría del día</h2>
        {payload.telemetriaDia.state === "ok" ? (
          <ul className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
            <li className="text-muted-foreground">Calorías (pulsera)</li>
            <li className="text-right font-medium">{payload.telemetriaDia.data.calorias_total ?? "—"}</li>
            <li className="text-muted-foreground">Pasos</li>
            <li className="text-right font-medium">{payload.telemetriaDia.data.pasos ?? "—"}</li>
            <li className="text-muted-foreground">Peso registrado</li>
            <li className="text-right font-medium">{payload.telemetriaDia.data.peso_actual_kg ?? "—"} kg</li>
            <li className="text-muted-foreground">Sueño (h)</li>
            <li className="text-right font-medium">{payload.telemetriaDia.data.sueno_horas ?? "—"}</li>
          </ul>
        ) : payload.telemetriaDia.state === "disabled" ? (
          <EmptyNote>
            Telemetría de pulsera desactivada: el maestro{" "}
            <code className="rounded bg-muted px-1">FITBIT_ACTIVO</code> debe ser{" "}
            <span className="font-mono">true</span>/<span className="font-mono">1</span> y{" "}
            <code className="rounded bg-muted px-1">NEXT_PUBLIC_FITBIT_UI_ENABLED</code> activa la lectura. El resto de
            la vista sigue disponible.
          </EmptyNote>
        ) : payload.telemetriaDia.state === "empty" ? (
          <EmptyNote>No hay fila en `telemetria_diaria` para esta fecha.</EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(payload.telemetriaDia.message)}</EmptyNote>
        )}
      </div>
      {!isSundayMadrid ? (
        <p className="text-xs text-muted-foreground" role="note">
          El domingo (Europe/Madrid) verás lista de compra para el lunes: generación con IA y, si existen,
          coincidencias en memoria.
        </p>
      ) : null}
    </section>
  );
}
