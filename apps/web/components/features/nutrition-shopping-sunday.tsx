import * as React from "react";

import type { NutritionDayPayload } from "@/lib/data/nutrition-day";

import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import { SundayShoppingCard } from "@/components/features/sunday-shopping-card";

interface NutritionShoppingSundayProps {
  readonly payload: NutritionDayPayload;
}

export function NutritionShoppingSunday({ payload }: NutritionShoppingSundayProps): React.ReactElement {
  return (
    <aside
      className="rounded-lg border-2 border-ring/60 bg-card p-4 shadow-sm shadow-ring/10"
      aria-labelledby="shopping-sunday-title"
    >
      <h2 id="shopping-sunday-title" className="text-base font-semibold tracking-tight text-foreground">
        Lista de compra (domingo → lunes)
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        El lunes por la mañana suele hacerse la compra: puedes generar con IA menú variado y lista. Abajo,
        notas detectadas en `memoria_ia` (compra, lista, súper).
      </p>
      <SundayShoppingCard
        fecha={payload.fecha}
        biometriaListo={payload.biometria.state === "ok"}
      />
      <div className="mt-3 flex flex-col gap-2">
        {payload.shoppingLines.state === "ok" ? (
          <ol className="list-decimal space-y-2 pl-4 text-sm text-foreground">
            {payload.shoppingLines.data.map((line) => (
              <li key={line.id} className="marker:text-muted-foreground">
                <span className="sr-only">Archivo fuente: </span>
                <span className="text-xs text-muted-foreground">{line.source_filename}</span>
                <p className="whitespace-pre-wrap">{line.contenido_linea}</p>
              </li>
            ))}
          </ol>
        ) : payload.shoppingLines.state === "empty" ? (
          <EmptyNote>No hay líneas candidatas para lista de compra en memoria reciente.</EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(payload.shoppingLines.message)}</EmptyNote>
        )}
      </div>
    </aside>
  );
}
