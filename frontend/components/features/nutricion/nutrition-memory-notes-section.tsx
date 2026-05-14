"use client";

import { useActionState } from "react";
import * as React from "react";

import {
  addNutritionMemoryNoteAction,
  nutritionWeekActionInitialState,
  type NutritionWeekActionState,
} from "@/app/actions/nutrition-week";
import { Button } from "@/components/ui/button";
import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import type { NutritionDayBlock } from "@/lib/data/nutrition-day";
import type { NutritionMemoryNoteRow } from "@/lib/schemas/nutrition-week";

export interface NutritionMemoryNotesSectionProps {
  readonly block: NutritionDayBlock<readonly NutritionMemoryNoteRow[]>;
  readonly canWrite: boolean;
}

export function NutritionMemoryNotesSection({
  block,
  canWrite,
}: NutritionMemoryNotesSectionProps): React.ReactElement {
  const [state, formAction, pending] = useActionState(addNutritionMemoryNoteAction, nutritionWeekActionInitialState);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" aria-labelledby="nut-mem-title">
      <h2 id="nut-mem-title" className="text-sm font-semibold text-foreground">
        Caja de peticiones (memoria)
      </h2>
      <p className="text-xs text-muted-foreground">Notas cortas para prompts (gustos, aversiones, recordatorios).</p>
      {block.state === "error" ? (
        <EmptyNote>{friendlyQueryMessage(block.message)}</EmptyNote>
      ) : block.state === "empty" ? (
        <p className="text-xs text-muted-foreground">Sin notas aún.</p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
          {block.data.map((n) => (
            <li key={n.id} className="rounded border border-border bg-background/50 px-2 py-1">
              {n.pinned ? (
                <span className="mr-1 text-[0.65rem] font-semibold uppercase text-ring">Fijada</span>
              ) : null}
              <span className="text-muted-foreground">{n.created_at.slice(0, 10)} · </span>
              <span className="whitespace-pre-wrap text-foreground">{n.content}</span>
            </li>
          ))}
        </ul>
      )}
      {canWrite ? (
        <form action={formAction} className="flex flex-col gap-2">
          <label htmlFor="nutrition-memory-content" className="text-xs font-medium text-foreground">
            Nueva nota
          </label>
          <textarea
            id="nutrition-memory-content"
            name="content"
            rows={3}
            maxLength={8000}
            required
            className="min-h-[5rem] rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Ej. prefiero arroz basmati; no cocinar con nata…"
          />
          <Button type="submit" size="sm" disabled={pending} className="w-fit">
            {pending ? "Guardando…" : "Añadir nota"}
          </Button>
          <MemoryActionMessage state={state} />
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">Inicia sesión para añadir notas.</p>
      )}
    </section>
  );
}

function MemoryActionMessage(props: { readonly state: NutritionWeekActionState }): React.ReactElement | null {
  if (props.state.kind === "idle") {
    return null;
  }
  if (props.state.kind === "ok") {
    return (
      <p className="text-xs text-emerald-400" role="status">
        {props.state.message}
      </p>
    );
  }
  return (
    <p className="text-xs text-destructive" role="alert">
      {props.state.message}
    </p>
  );
}
