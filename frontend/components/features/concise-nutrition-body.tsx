import * as React from "react";

import { bodyToConciseNutritionViewModel } from "@/lib/nutrition/concise-nutrition-body";
import { cn } from "@/lib/utils";
import { emptyNutritionStructuredList } from "@/lib/ui/single-user-placeholders";

interface ConciseNutritionBodyProps {
  readonly body: string;
  readonly className?: string;
}

export function ConciseNutritionBody({ body, className }: ConciseNutritionBodyProps): React.ReactElement {
  const vm = bodyToConciseNutritionViewModel(body);
  if (vm.kind === "list") {
    if (vm.items.length === 0) {
      return <p className={cn("text-xs text-muted-foreground", className)}>{emptyNutritionStructuredList}</p>;
    }
    return (
      <ul className={cn("list-disc space-y-1 pl-4 text-sm text-foreground", className)}>
        {vm.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className={className}>
      <p className="text-sm leading-relaxed text-foreground">{vm.text.length > 0 ? vm.text : "—"}</p>
      {vm.showPromptHint ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
          Texto mayormente narrativo: pendiente de ajustar el prompt para listas con cantidades.
        </p>
      ) : null}
    </div>
  );
}
