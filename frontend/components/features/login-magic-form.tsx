"use client";

import { useActionState } from "react";
import * as React from "react";

import { sendMagicLink, type MagicLinkFormState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

const initialState: MagicLinkFormState = { kind: "idle" };

export function LoginMagicForm(): React.ReactElement {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate aria-describedby="login-magic-help">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="tu@correo.com"
        />
      </div>
      <Button type="submit" disabled={pending} variant="default">
        {pending ? "Enviando…" : "Enlace mágico"}
      </Button>
      <p id="login-magic-help" className="text-xs text-muted-foreground">
        Recibirás un enlace para iniciar sesión. Sin contraseña en servidor (solo clave anon).
      </p>
      {state.kind === "sent" ? (
        <p className="text-sm text-emerald-400" role="status">
          Revisa tu bandeja (y spam) para continuar.
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
