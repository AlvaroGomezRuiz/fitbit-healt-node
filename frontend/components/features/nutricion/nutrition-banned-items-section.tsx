"use client";

import { useActionState } from "react";
import * as React from "react";

import {
  addNutritionBannedItemAction,
  deleteNutritionBannedItemAction,
  nutritionWeekActionInitialState,
  type NutritionWeekActionState,
} from "@/app/actions/nutrition-week";
import { Button } from "@/components/ui/button";
import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import type { NutritionDayBlock } from "@/lib/data/nutrition-day";
import type { NutritionBannedItemRow } from "@/lib/schemas/nutrition-week";

export interface NutritionBannedItemsSectionProps {
  readonly block: NutritionDayBlock<readonly NutritionBannedItemRow[]>;
  readonly canWrite: boolean;
}

export function NutritionBannedItemsSection({
  block,
  canWrite,
}: NutritionBannedItemsSectionProps): React.ReactElement {
  const [addState, addAction, addPending] = useActionState(addNutritionBannedItemAction, nutritionWeekActionInitialState);
  const [delState, delAction, delPending] = useActionState(
    deleteNutritionBannedItemAction,
    nutritionWeekActionInitialState,
  );

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" aria-labelledby="nut-ban-title">
      <h2 id="nut-ban-title" className="text-sm font-semibold text-foreground">
        Prohibidos (lista)
      </h2>
      <p className="text-xs text-muted-foreground">
        Catálogo base del producto en seed DB-06; puedes ampliar o quitar entradas propias si tienes sesión.
      </p>
      {block.state === "error" ? (
        <EmptyNote>{friendlyQueryMessage(block.message)}</EmptyNote>
      ) : block.state === "empty" ? (
        <p className="text-xs text-muted-foreground">Sin filas (tabla no migrada o vacía).</p>
      ) : (
        <ul className="columns-1 gap-x-6 text-sm sm:columns-2">
          {block.data.map((row) => (
            <li key={row.id} className="mb-1 flex items-center justify-between gap-2 break-inside-avoid">
              <span className="text-foreground">{row.label}</span>
              {canWrite ? (
                <form action={delAction} className="shrink-0">
                  <input type="hidden" name="id" value={row.id} readOnly />
                  <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={delPending}>
                    Quitar
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canWrite ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <form action={addAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="banned-label" className="text-xs font-medium text-foreground">
                Añadir prohibido
              </label>
              <input
                id="banned-label"
                name="label"
                type="text"
                maxLength={300}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Ej. sardinas en lata"
              />
            </div>
            <Button type="submit" size="sm" disabled={addPending} className="shrink-0">
              {addPending ? "…" : "Añadir"}
            </Button>
          </form>
          <BannedActionMessages addState={addState} delState={delState} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Inicia sesión para editar la lista.</p>
      )}
    </section>
  );
}

function BannedActionMessages(props: {
  readonly addState: NutritionWeekActionState;
  readonly delState: NutritionWeekActionState;
}): React.ReactElement {
  return (
    <div aria-live="polite" className="space-y-1 text-xs">
      {props.addState.kind === "ok" ? <p className="text-emerald-400">{props.addState.message}</p> : null}
      {props.addState.kind === "error" ? <p className="text-destructive">{props.addState.message}</p> : null}
      {props.delState.kind === "ok" ? <p className="text-emerald-400">{props.delState.message}</p> : null}
      {props.delState.kind === "error" ? <p className="text-destructive">{props.delState.message}</p> : null}
    </div>
  );
}
