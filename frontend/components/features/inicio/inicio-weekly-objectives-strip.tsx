import * as React from "react";

import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import type { HomeWeeklyObjectiveBlock } from "@/lib/data/weekly-objective-home";

export interface InicioWeeklyObjectivesStripProps {
  readonly block: HomeWeeklyObjectiveBlock;
}

function formatKg(value: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value);
}

export function InicioWeeklyObjectivesStrip({ block }: InicioWeeklyObjectivesStripProps): React.ReactElement {
  if (block.state === "empty") {
    return (
      <section
        aria-labelledby="obj-semanal-heading"
        className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm dark:bg-muted/10"
      >
        <h2 id="obj-semanal-heading" className="text-sm font-semibold text-foreground">
          Objetivos de la semana
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sin fila de objetivos para el lunes de esta semana (o la migración de objetivos semanales aún no está en el
          proyecto remoto).
        </p>
      </section>
    );
  }
  if (block.state === "error") {
    return (
      <section aria-labelledby="obj-semanal-heading" className="rounded-lg border border-border bg-card px-4 py-3">
        <h2 id="obj-semanal-heading" className="text-sm font-semibold text-foreground">
          Objetivos de la semana
        </h2>
        <div className="mt-2">
          <EmptyNote>{friendlyQueryMessage(block.message)}</EmptyNote>
        </div>
      </section>
    );
  }

  const { data } = block;
  const hasPr = data.prTargets.length > 0;
  const hasPeso = data.targetWeightKg !== null && data.targetWeightKg > 0;
  const hasNotes = data.notes !== null && data.notes.trim().length > 0;

  if (!hasPr && !hasPeso && !hasNotes) {
    return (
      <section aria-labelledby="obj-semanal-heading" className="rounded-lg border border-border bg-card px-4 py-3">
        <h2 id="obj-semanal-heading" className="text-sm font-semibold text-foreground">
          Objetivos de la semana
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Semana {data.semanaInicioLegible}: sin metas numéricas aún.</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="obj-semanal-heading"
      className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground"
    >
      <h2 id="obj-semanal-heading" className="text-sm font-semibold text-foreground">
        Objetivos de la semana
      </h2>
      <p className="mt-1 text-xs capitalize text-muted-foreground">Inicio semana: {data.semanaInicioLegible}</p>
      {hasPeso ? (
        <p className="mt-2 text-foreground">
          Peso objetivo: <span className="font-medium">{formatKg(data.targetWeightKg ?? 0)} kg</span>
        </p>
      ) : null}
      {hasNotes ? <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{data.notes}</p> : null}
      {hasPr ? (
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {data.prTargets.map((pr, idx) => (
            <li key={`${idx}-${pr.exerciseName}`} className="flex justify-between gap-2 text-xs">
              <span className="text-foreground">{pr.exerciseName}</span>
              <span className="shrink-0 text-muted-foreground">
                {formatKg(pr.weightKg)} kg × {pr.reps}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
