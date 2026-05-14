"use client";

import * as React from "react";

interface InformesErrorProps {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}

export default function InformesError(props: InformesErrorProps): React.ReactElement {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4"
      role="alert"
    >
      <h2 className="text-sm font-semibold text-destructive">Error en informes</h2>
      <p className="text-sm text-muted-foreground">{props.error.message}</p>
      <button
        type="button"
        className="w-fit rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60"
        onClick={(): void => {
          props.reset();
        }}
      >
        Reintentar
      </button>
    </div>
  );
}
