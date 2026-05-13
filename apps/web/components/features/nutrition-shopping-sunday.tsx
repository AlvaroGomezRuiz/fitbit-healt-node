import * as React from "react";

import type { NutritionDayPayload } from "@/lib/data/nutrition-day";

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
        Compra y menú (IA)
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Los domingos el cron escribe la nota semanal en memoria; la lista vale toda la semana y el menú se lee por día
        civil en Madrid.
      </p>
      <SundayShoppingCard
        markdown={markdown}
        todayMadridIso={payload.todayMadridIso}
        listError={
          payload.shoppingLines.state === "error"
            ? friendlyQueryMessage(payload.shoppingLines.message)
            : undefined
        }
      />
    </aside>
  );
}
