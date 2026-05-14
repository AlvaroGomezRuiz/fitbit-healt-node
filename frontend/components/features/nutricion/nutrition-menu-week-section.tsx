import * as React from "react";

import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import type { NutritionDayBlock } from "@/lib/data/nutrition-day";
import type { NutritionMenuWeekRow } from "@/lib/data/nutrition-menu-week";
import { NUTRITION_MENU_DAY_KEYS, type NutritionMenuDayKey } from "@/lib/schemas/nutrition-week";

const DIA_CORTO_ES: Readonly<Record<NutritionMenuDayKey, string>> = {
  MON: "Lun",
  TUE: "Mar",
  WED: "Mié",
  THU: "Jue",
  FRI: "Vie",
  SAT: "Sáb",
  SUN: "Dom",
};

function renderMenuValue(value: unknown, depth: number): React.ReactNode {
  if (depth > 4) {
    return <span className="text-muted-foreground">…</span>;
  }
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="text-foreground">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc space-y-0.5 pl-4 text-xs">
        {value.map((v, i) => (
          <li key={i}>{renderMenuValue(v, depth + 1)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div className="mt-1 space-y-2 border-l border-border pl-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <p className="text-xs font-medium text-foreground">{k}</p>
            <div className="text-xs text-muted-foreground">{renderMenuValue(v, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

export interface NutritionMenuWeekSectionProps {
  readonly block: NutritionDayBlock<NutritionMenuWeekRow>;
}

export function NutritionMenuWeekSection({ block }: NutritionMenuWeekSectionProps): React.ReactElement {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" aria-labelledby="nut-menu-db-title">
      <header className="flex flex-col gap-1">
        <h2 id="nut-menu-db-title" className="text-sm font-semibold text-foreground">
          Menú L–D (base de datos)
        </h2>
        <p className="text-xs text-muted-foreground">
          Claves de día esperadas: MON … SUN. El cron puede rellenar secciones (desayuno, comida, etc.).
        </p>
      </header>
      {block.state === "error" ? (
        <EmptyNote>{friendlyQueryMessage(block.message)}</EmptyNote>
      ) : block.state === "empty" ? (
        <p className="text-sm text-muted-foreground">Sin menú semanal en Supabase para esta semana.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">Actualizado: {block.data.updatedAt}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {NUTRITION_MENU_DAY_KEYS.map((key) => {
              const day = block.data.days[key];
              if (day === undefined) {
                return (
                  <article
                    key={key}
                    className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 dark:bg-muted/10"
                  >
                    <h3 className="text-xs font-semibold text-muted-foreground">
                      {DIA_CORTO_ES[key]} ({key})
                    </h3>
                    <p className="text-xs text-muted-foreground">Sin datos.</p>
                  </article>
                );
              }
              return (
                <article key={key} className="rounded-md border border-border bg-background/60 px-3 py-2">
                  <h3 className="text-xs font-semibold text-foreground">
                    {DIA_CORTO_ES[key]} ({key})
                  </h3>
                  <div className="mt-1 text-xs leading-relaxed">{renderMenuValue(day, 0)}</div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
