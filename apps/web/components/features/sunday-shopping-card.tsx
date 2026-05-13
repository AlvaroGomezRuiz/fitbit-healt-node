"use client";

import * as React from "react";

import { generateNutritionSundayShoppingAction } from "@/app/actions/nutrition-shopping";
import type { NutritionSundayShoppingResult } from "@/app/actions/nutrition-shopping";
import { parseSundayShoppingMarkdown } from "@/lib/nutrition/parse-sunday-shopping-markdown";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

interface SundayShoppingCardProps {
  readonly fecha: string;
  readonly biometriaListo: boolean;
}

type UiState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "success"; readonly markdown: string }
  | { readonly kind: "error"; readonly message: string };

function MarkdownBlock({
  text,
  className,
}: {
  readonly text: string;
  readonly className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-foreground dark:bg-card",
        className,
      )}
    >
      {text}
    </div>
  );
}

function SundayShoppingResult({
  markdown,
}: {
  readonly markdown: string;
}): React.ReactElement {
  const parsed = React.useMemo(() => parseSundayShoppingMarkdown(markdown), [markdown]);
  const hasStructure = parsed.shopping.length > 0 || parsed.dayPanels.length > 0;
  const fallbackText =
    parsed.remainder.length > 0 ? parsed.remainder : markdown.trim().length > 0 ? markdown : "";

  if (!hasStructure && fallbackText.length > 0) {
    return (
      <MarkdownBlock
        className="mt-3 max-h-[min(70vh,520px)] overflow-auto"
        text={fallbackText}
      />
    );
  }

  return (
    <div className="mt-3 space-y-4">
      {parsed.shopping.length > 0 ? (
        <section aria-labelledby="shopping-list-heading">
          <h4 id="shopping-list-heading" className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Lista de compra
          </h4>
          <MarkdownBlock className="mt-2 max-h-[min(40vh,320px)] overflow-auto" text={parsed.shopping} />
        </section>
      ) : null}

      {parsed.dayPanels.length > 0 ? (
        <section aria-labelledby="week-menu-heading" className="space-y-2">
          <h4 id="week-menu-heading" className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Menú por días
          </h4>
          <div className="space-y-2">
            {parsed.dayPanels.map((d) => (
              <details
                key={d.day}
                className="group rounded-md border border-border bg-muted/20 open:bg-muted/35 dark:bg-muted/10 dark:open:bg-muted/20"
              >
                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex w-full items-center justify-between gap-2">
                    {d.day}
                    <span className="text-xs font-normal text-muted-foreground group-open:hidden">Desplegar</span>
                    <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Ocultar</span>
                  </span>
                </summary>
                <div className="border-t border-border px-3 py-2">
                  <MarkdownBlock text={d.body} />
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {parsed.remainder.length > 0 ? (
        <section aria-labelledby="extra-heading">
          <h4 id="extra-heading" className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Notas adicionales
          </h4>
          <MarkdownBlock className="mt-2 max-h-[min(30vh,240px)] overflow-auto" text={parsed.remainder} />
        </section>
      ) : null}
    </div>
  );
}

export function SundayShoppingCard({ fecha, biometriaListo }: SundayShoppingCardProps): React.ReactElement {
  const [ui, setUi] = React.useState<UiState>({ kind: "idle" });

  const onGenerar = (): void => {
    setUi({ kind: "loading" });
    void (async () => {
      const result: NutritionSundayShoppingResult = await generateNutritionSundayShoppingAction({ fecha });
      if (result.ok === true) {
        setUi({ kind: "success", markdown: result.markdown });
      } else {
        setUi({ kind: "error", message: result.message });
      }
    })();
  };

  const disabled = !biometriaListo || ui.kind === "loading";

  return (
    <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 dark:bg-muted/15">
      <h3 className="text-sm font-semibold text-foreground">Lista de compra y menú semanal (IA)</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Primero verás la <strong className="text-foreground">lista de compra</strong>; debajo, un desplegable por cada
        día (Lunes a Domingo). Requiere que la IA siga el formato con encabezados <code className="text-foreground">##</code>.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={disabled} onClick={onGenerar}>
          {ui.kind === "loading" ? "Generando…" : "Generar con IA"}
        </Button>
        {!biometriaListo ? (
          <span className="text-xs text-muted-foreground">Necesitas biometría maestra cargada.</span>
        ) : null}
      </div>
      {ui.kind === "error" ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {ui.message}
        </p>
      ) : null}
      {ui.kind === "success" ? <SundayShoppingResult markdown={ui.markdown} /> : null}
    </div>
  );
}
