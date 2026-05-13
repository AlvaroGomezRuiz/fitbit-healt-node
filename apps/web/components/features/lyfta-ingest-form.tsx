"use client";

import * as React from "react";
import { useActionState } from "react";

import { analyzeLyftaSessionAction } from "@/app/actions/lyfta-analyze";
import { ingestLyftaAction } from "@/app/actions/lyfta-ingest";
import { initialLyftaAnalyzeState, type LyftaAnalyzeState } from "@/lib/actions/lyfta-ai-state";
import { initialLyftaIngestState } from "@/lib/actions/lyfta-state";
import type { LyftaIngestState } from "@/lib/actions/lyfta-types";

export function LyftaIngestForm(): React.ReactElement {
  const [state, formAction, isPending] = useActionState(ingestLyftaAction, initialLyftaIngestState);
  const [analyzeState, analyzeAction, analyzePending] = useActionState(
    analyzeLyftaSessionAction,
    initialLyftaAnalyzeState,
  );
  const [summarizeId, setSummarizeId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (state.status === "success") {
      setSummarizeId(state.insertedId);
    }
  }, [state]);

  return (
    <div className="flex flex-col gap-3">
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

      {summarizeId !== null ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <h3 className="text-xs font-medium text-foreground">Resumen con IA (DeepSeek)</h3>
          <p className="text-xs text-muted-foreground">
            Usa el último id guardado en esta sesión de página. Requiere{" "}
            <code className="rounded bg-muted px-1">DEEPSEEK_API_KEY</code> en el servidor.
          </p>
          <form action={analyzeAction} className="flex flex-col gap-2">
            <input type="hidden" name="entrenoHistoricoId" value={summarizeId} readOnly />
            <button
              type="submit"
              disabled={analyzePending}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {analyzePending ? "Generando…" : "Resumir con IA"}
            </button>
            <LyftaAnalyzeFeedback state={analyzeState} />
          </form>
        </div>
      ) : null}
    </div>
  );
}

function LyftaAnalyzeFeedback({ state }: { readonly state: LyftaAnalyzeState }): React.ReactElement | null {
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
  return (
    <p className="whitespace-pre-wrap text-xs text-muted-foreground" aria-live="polite">
      {state.reply}
    </p>
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
          {state.status === "success" ? (
            <li className="list-none pl-0">
              <details className="mt-1 rounded-md border border-border bg-muted/30 px-2 py-1">
                <summary className="cursor-pointer text-foreground/90">Vista previa del texto guardado (recorte)</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap wrap-break-word text-[0.65rem] leading-snug text-muted-foreground">
                  {state.textPreview}
                </pre>
              </details>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
