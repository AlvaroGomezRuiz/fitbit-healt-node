"use client";

import { useActionState, useMemo, useState } from "react";
import * as React from "react";

import {
  nutritionWeekActionInitialState,
  saveNutritionShoppingWeekAction,
} from "@/app/actions/nutrition-week";
import { Button } from "@/components/ui/button";
import type { NutritionShoppingItem } from "@/lib/schemas/nutrition-week";

export interface NutritionShoppingWeekEditorProps {
  readonly semanaInicio: string;
  readonly canWrite: boolean;
  readonly initialItems: readonly NutritionShoppingItem[];
}

function cloneItems(items: readonly NutritionShoppingItem[]): NutritionShoppingItem[] {
  return items.map((it) => ({
    name: it.name,
    quantity: it.quantity ?? null,
    priority: it.priority ?? null,
  }));
}

export function NutritionShoppingWeekEditor({
  semanaInicio,
  canWrite,
  initialItems,
}: NutritionShoppingWeekEditorProps): React.ReactElement {
  const [items, setItems] = useState<NutritionShoppingItem[]>(() => cloneItems(initialItems));
  const [state, formAction, pending] = useActionState(saveNutritionShoppingWeekAction, nutritionWeekActionInitialState);

  const itemsJson = useMemo(() => JSON.stringify(items), [items]);

  const addRow = (): void => {
    setItems((prev) => [...prev, { name: "", quantity: "", priority: 0 }]);
  };

  const updateRow = (index: number, patch: Partial<NutritionShoppingItem>): void => {
    setItems((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (cur === undefined) {
        return prev;
      }
      next[index] = { ...cur, ...patch };
      return next;
    });
  };

  const removeRow = (index: number): void => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  if (!canWrite) {
    return (
      <p className="text-xs text-muted-foreground">
        Inicia sesión para editar la lista de compra en base de datos (tabla semanal).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="semana_inicio" value={semanaInicio} readOnly />
        <input type="hidden" name="items_json" value={itemsJson} readOnly />
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[320px] border-collapse text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="border-b border-border px-2 py-2 font-medium">Prioridad</th>
                <th className="border-b border-border px-2 py-2 font-medium">Alimento</th>
                <th className="border-b border-border px-2 py-2 font-medium">Cantidad</th>
                <th className="border-b border-border px-2 py-2 font-medium w-10" aria-label="Eliminar fila" />
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr key={`row-${idx}`} className="border-b border-border last:border-0">
                  <td className="px-2 py-1 align-top">
                    <input
                      type="number"
                      inputMode="numeric"
                      className="h-9 w-16 rounded border border-border bg-background px-1 text-foreground"
                      value={row.priority ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Number.parseInt(e.target.value, 10);
                        updateRow(idx, { priority: Number.isFinite(v) ? v : null });
                      }}
                      aria-label={`Prioridad fila ${idx + 1}`}
                    />
                  </td>
                  <td className="px-2 py-1 align-top">
                    <input
                      type="text"
                      className="h-9 w-full min-w-[8rem] rounded border border-border bg-background px-2 text-foreground"
                      value={row.name}
                      onChange={(e) => {
                        updateRow(idx, { name: e.target.value });
                      }}
                      aria-label={`Nombre fila ${idx + 1}`}
                    />
                  </td>
                  <td className="px-2 py-1 align-top">
                    <input
                      type="text"
                      className="h-9 w-full min-w-[6rem] rounded border border-border bg-background px-2 text-foreground"
                      value={typeof row.quantity === "string" ? row.quantity : row.quantity ?? ""}
                      onChange={(e) => {
                        updateRow(idx, { quantity: e.target.value });
                      }}
                      aria-label={`Cantidad fila ${idx + 1}`}
                    />
                  </td>
                  <td className="px-1 py-1 align-top text-center">
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => removeRow(idx)}>
                      Quitar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            Añadir fila
          </Button>
          <Button type="submit" disabled={pending} size="sm">
            {pending ? "Guardando…" : "Guardar en Supabase"}
          </Button>
        </div>
      </form>
      <div aria-live="polite" className="min-h-5 text-sm">
        {state.kind === "ok" ? <p className="text-emerald-400">{state.message}</p> : null}
        {state.kind === "error" ? (
          <p className="text-destructive" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
