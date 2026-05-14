import Link from "next/link";
import * as React from "react";

import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import type { NutritionDayBlock } from "@/lib/data/nutrition-day";

export interface NutritionWeekHistorySectionProps {
  readonly block: NutritionDayBlock<readonly string[]>;
  readonly semanaActual: string;
}

export function NutritionWeekHistorySection({
  block,
  semanaActual,
}: NutritionWeekHistorySectionProps): React.ReactElement {
  return (
    <section className="rounded-lg border border-border bg-muted/20 px-4 py-3 dark:bg-muted/10" aria-labelledby="nut-week-hist-title">
      <h2 id="nut-week-hist-title" className="text-sm font-semibold text-foreground">
        Historial de semanas
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">Abre otra semana usando el lunes civil como día en la URL.</p>
      {block.state === "error" ? (
        <EmptyNote>{friendlyQueryMessage(block.message)}</EmptyNote>
      ) : block.state === "empty" ? (
        <p className="mt-2 text-xs text-muted-foreground">Aún no hay semanas registradas en compra o menú.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {block.data.map((mon) => {
            const active = mon === semanaActual;
            return (
              <li key={mon}>
                <Link
                  href={`/nutrition?fecha=${mon}`}
                  prefetch={false}
                  className={
                    active
                      ? "inline-flex rounded-md border border-ring bg-card px-2 py-1 text-xs font-medium text-foreground"
                      : "inline-flex rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }
                  aria-current={active ? "page" : undefined}
                >
                  {mon}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
