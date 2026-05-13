"use client";

import * as React from "react";
import { useActionState } from "react";

import { ingestLyftaAction } from "@/app/actions/lyfta-ingest";
import { initialLyftaIngestState } from "@/lib/actions/lyfta-state";
import type { LyftaIngestState } from "@/lib/actions/lyfta-types";

export function LyftaIngestForm(): React.ReactElement {
  const [state, formAction, isPending] = useActionState(ingestLyftaAction, initialLyftaIngestState);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <h2 className="text-sm font-medium text-foreground">Pegar Lyfta (entrenos_historico)</h2>
      <label htmlFor="lyfta-raw" className="text-xs text-muted-foreground">
        Texto crudo
      </label>
      <textarea
        id="lyfta-raw"
        name="rawText"
        required
        rows={6}
        className="min-h-32 w-full resize-y rounded-md border border-input bg-background px-2 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Pega aquí el contenido exportado o copiado de Lyfta…"
      />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground disabled:opacity-50"
      >
        {isPending ? "Procesando…" : "Analizar y guardar"}
      </button>
      <LyftaFeedback state={state} />
    </form>
  );
}

function LyftaFeedback({ state }: { readonly state: LyftaIngestState }): React.ReactElement | null {
  if (state.status === "idle") {
    return null;
  }
  if (state.status === "error") {
    return (
      <p className="text-xs text-destructive" role="alert">
        {state.message}
      </p>
    );
  }
  const tone =
    state.status === "success"
      ? "text-emerald-400"
      : state.status === "stub"
        ? "text-amber-400"
        : "text-muted-foreground";
  return (
    <div className={`flex flex-col gap-1 text-xs ${tone}`} aria-live="polite">
      <p>{state.message}</p>
      {"structured" in state ? (
        <ul className="list-inside list-disc text-muted-foreground">
          <li>Título: {state.structured.sessionTitle}</li>
          <li>Fecha sesión: {state.structured.sessionDate}</li>
          <li>Líneas: {state.structured.lineCount}</li>
          <li className="list-none pl-0 text-[0.7rem] leading-snug text-muted-foreground/90">
            Identificador interno para no duplicar el mismo pegado (no hace falta copiarlo ni memorizarlo).
          </li>
          {state.status === "success" ? <li>Id guardado: {state.insertedId}</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
