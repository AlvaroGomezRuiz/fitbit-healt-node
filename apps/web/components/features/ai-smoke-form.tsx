"use client";

import * as React from "react";
import { useActionState } from "react";

import { runAiSmokeAction } from "@/app/actions/ai-smoke";
import { initialAiSmokeState, type AiSmokeState } from "@/lib/actions/ai-state";

export function AiSmokeForm(): React.ReactElement {
  const [state, formAction, isPending] = useActionState(runAiSmokeAction, initialAiSmokeState);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <h2 className="text-sm font-medium text-foreground">Prueba IA (DeepSeek)</h2>
      <p className="text-xs text-muted-foreground">
        Solo servidor: reexporta el módulo raíz <code className="rounded bg-muted px-1">lib/ai</code>. Requiere{" "}
        <code className="rounded bg-muted px-1">DEEPSEEK_API_KEY</code> en apps/web.
      </p>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isPending ? "Llamando…" : "Ejecutar cascada"}
      </button>
      <AiSmokeFeedback state={state} />
    </form>
  );
}

function AiSmokeFeedback({ state }: { readonly state: AiSmokeState }): React.ReactElement | null {
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
    <p className="text-xs text-muted-foreground" aria-live="polite">
      {state.reply}
    </p>
  );
}
