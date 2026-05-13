import * as React from "react";

import type { NutritionDayPayload } from "@/lib/data/nutrition-day";

import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import { SundayShoppingCard } from "@/components/features/sunday-shopping-card";

interface NutritionShoppingSundayProps {
  readonly payload: NutritionDayPayload;
}

function buildSundayShoppingMarkdownFromPayload(
  shoppingLines: NutritionDayPayload["shoppingLines"],
): string {
  if (shoppingLines.state !== "ok") {
    return "";
  }
  return shoppingLines.data
    .map((row) => row.contenido_linea.trim())
    .filter((line) => line.length > 0)
    .join("\n\n");
}

export function NutritionShoppingSunday({ payload }: NutritionShoppingSundayProps): React.ReactElement {
  const markdown = buildSundayShoppingMarkdownFromPayload(payload.shoppingLines);

  return (
    <aside
      className="rounded-lg border-2 border-ring/60 bg-card p-4 shadow-sm shadow-ring/10"
      aria-labelledby="shopping-sunday-title"
    >
      <h2 id="shopping-sunday-title" className="text-base font-semibold tracking-tight text-foreground">
        Lista de compra y menú semanal
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Este bloque se muestra al final de la vista. La lista y el menú se generan automáticamente los domingos
        (~10:00 Madrid, cron `nutrition-shopping-weekly`) con `CRON_NUTRITION_SHOPPING_DEEPSEEK` y se guardan en
        `memoria_ia`. Abajo, el detalle línea a línea de las mismas notas candidatas cuando existan.
      </p>
      <SundayShoppingCard
        markdown={markdown}
        listError={
          payload.shoppingLines.state === "error"
            ? friendlyQueryMessage(payload.shoppingLines.message)
            : undefined
        }
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
          <EmptyNote>
            No hay líneas candidatas en memoria reciente para esta fecha. Tras el cron del domingo deberían
            aparecer aquí; también puedes revisar días recientes donde ya hubiera notas de compra guardadas.
          </EmptyNote>
        ) : (
          <EmptyNote>{friendlyQueryMessage(payload.shoppingLines.message)}</EmptyNote>
        )}
      </div>
    </aside>
  );
}
