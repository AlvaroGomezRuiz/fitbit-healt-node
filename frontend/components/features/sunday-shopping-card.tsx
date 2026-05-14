import * as React from "react";

import { ConciseNutritionBody } from "@/components/features/concise-nutrition-body";
import { weekdayLabelEsMadrid } from "@/lib/data/date-madrid";
import { parseSundayShoppingMarkdown } from "@/lib/nutrition/parse-sunday-shopping-markdown";
import {
  emptyShoppingListInWeeklyNote,
  emptyWeeklyShoppingNote,
  formatEmptyMenuBlockForDay,
  sundayCardListFootnote,
} from "@/lib/ui/single-user-placeholders";

interface SundayShoppingCardProps {
  readonly markdown: string;
  /** Si la consulta a notas guardadas falló: evita mensaje de “vacío” engañoso en la tarjeta. */
  readonly listError?: string;
  /** Fecha civil Madrid (`YYYY-MM-DD`) para mostrar solo el menú del día actual en esa zona. */
  readonly todayMadridIso: string;
}

interface ShoppingMenuSplitProps {
  readonly markdown: string;
  readonly todayMadridIso: string;
}

function ShoppingMenuSplit({ markdown, todayMadridIso }: ShoppingMenuSplitProps): React.ReactElement {
  const parsed = parseSundayShoppingMarkdown(markdown);
  const todayLabel = weekdayLabelEsMadrid(todayMadridIso);
  const todayPanel = parsed.dayPanels.find((d) => d.day === todayLabel);
  const shoppingBody = parsed.shopping.trim();

  return (
    <div className="mt-4 space-y-6">
      <section aria-labelledby="nutrition-shopping-list-title" className="rounded-md border border-border bg-muted/20 p-3 dark:bg-muted/10">
        <h3 id="nutrition-shopping-list-title" className="text-sm font-semibold text-foreground">
          Lista de compra
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{sundayCardListFootnote}</p>
        {shoppingBody.length > 0 ? (
          <div className="mt-2">
            <ConciseNutritionBody body={shoppingBody} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{emptyShoppingListInWeeklyNote}</p>
        )}
      </section>

      <section aria-labelledby="nutrition-week-menu-title" className="rounded-md border border-border bg-muted/20 p-3 dark:bg-muted/10">
        <h3 id="nutrition-week-menu-title" className="text-sm font-semibold text-foreground">
          Menú semanal (hoy = día civil Madrid)
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Solo <span className="font-medium text-foreground">{todayLabel}</span> · {todayMadridIso}
        </p>
        {todayPanel !== undefined && todayPanel.body.trim().length > 0 ? (
          <div className="mt-2">
            <ConciseNutritionBody body={todayPanel.body} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{formatEmptyMenuBlockForDay(todayLabel)}</p>
        )}
      </section>

      {parsed.remainder.trim().length > 0 ? (
        <section aria-labelledby="nutrition-shopping-extra" className="rounded-md border border-dashed border-border p-3">
          <h3 id="nutrition-shopping-extra" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Otras notas
          </h3>
          <div className="mt-2">
            <ConciseNutritionBody body={parsed.remainder} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function SundayShoppingCard({
  markdown,
  listError,
  todayMadridIso,
}: SundayShoppingCardProps): React.ReactElement {
  const trimmed = markdown.trim();
  const listErrorTrimmed = listError?.trim() ?? "";
  const hasListError = listErrorTrimmed.length > 0;

  return (
    <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 dark:bg-muted/15">
      {hasListError ? (
        <p className="text-xs text-destructive" role="alert">
          {listErrorTrimmed}
        </p>
      ) : trimmed.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyWeeklyShoppingNote}</p>
      ) : (
        <ShoppingMenuSplit markdown={trimmed} todayMadridIso={todayMadridIso} />
      )}
    </div>
  );
}
