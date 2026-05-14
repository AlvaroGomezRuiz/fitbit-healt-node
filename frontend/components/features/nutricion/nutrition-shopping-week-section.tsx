import Link from "next/link";
import * as React from "react";

import { NutritionShoppingWeekEditor } from "@/components/features/nutricion/nutrition-shopping-week-editor";
import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import type { NutritionDayBlock } from "@/lib/data/nutrition-day";
import type { NutritionShoppingWeekRow } from "@/lib/data/nutrition-shopping-week";

export interface NutritionShoppingWeekSectionProps {
  readonly block: NutritionDayBlock<NutritionShoppingWeekRow>;
  readonly semanaInicio: string;
  readonly canWrite: boolean;
}

export function NutritionShoppingWeekSection({
  block,
  semanaInicio,
  canWrite,
}: NutritionShoppingWeekSectionProps): React.ReactElement {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" aria-labelledby="nut-shop-db-title">
      <header className="flex flex-col gap-1">
        <h2 id="nut-shop-db-title" className="text-sm font-semibold text-foreground">
          Compra semanal (base de datos)
        </h2>
        <p className="text-xs text-muted-foreground">
          Semana que contiene el día seleccionado: lunes <span className="font-mono text-foreground">{semanaInicio}</span>{" "}
          (Madrid).
        </p>
      </header>
      {block.state === "error" ? (
        <EmptyNote>{friendlyQueryMessage(block.message)}</EmptyNote>
      ) : block.state === "empty" ? (
        canWrite ? (
          <NutritionShoppingWeekEditor semanaInicio={semanaInicio} canWrite={canWrite} initialItems={[]} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin fila de compra para esta semana. Inicia sesión para crear la primera desde aquí.
          </p>
        )
      ) : (
        <>
          {!canWrite ? (
            <>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[280px] border-collapse text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="border-b border-border px-2 py-2 font-medium">Prio</th>
                      <th className="border-b border-border px-2 py-2 font-medium">Alimento</th>
                      <th className="border-b border-border px-2 py-2 font-medium">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.data.items.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-2 py-3 text-muted-foreground">
                          Lista vacía.
                        </td>
                      </tr>
                    ) : (
                      block.data.items.map((row, idx) => (
                        <tr key={`${idx}-${row.name}`} className="border-b border-border last:border-0">
                          <td className="px-2 py-1 text-muted-foreground">{row.priority ?? "—"}</td>
                          <td className="px-2 py-1 text-foreground">{row.name}</td>
                          <td className="px-2 py-1 text-muted-foreground">{row.quantity ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">Actualizado: {block.data.updatedAt}</p>
              <p className="text-xs text-muted-foreground">
                Solo lectura.{" "}
                <Link className="font-medium text-ring underline-offset-4 hover:underline" href="/login">
                  Iniciar sesión
                </Link>{" "}
                para guardar cambios.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Última escritura conocida: {block.data.updatedAt}</p>
              <NutritionShoppingWeekEditor
                semanaInicio={semanaInicio}
                canWrite={canWrite}
                initialItems={block.data.items}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
