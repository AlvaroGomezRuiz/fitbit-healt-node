"use client";

import { useActionState } from "react";
import Link from "next/link";
import * as React from "react";

import {
  submitDomingoPesoAyunas,
  type DomingoPesoAyunasFormState,
} from "@/app/actions/domingo-peso-ayunas";
import { Button } from "@/components/ui/button";

const initialDomingoPesoState: DomingoPesoAyunasFormState = { kind: "idle" };

export interface InicioDomingoPesoFormProps {
  readonly ventanaActiva: boolean;
  readonly usuarioAutenticado: boolean;
  readonly defaultPesoText: string;
}

export function InicioDomingoPesoForm({
  ventanaActiva,
  usuarioAutenticado,
  defaultPesoText,
}: InicioDomingoPesoFormProps): React.ReactElement {
  const [state, formAction, pending] = useActionState(submitDomingoPesoAyunas, initialDomingoPesoState);

  if (!ventanaActiva) {
    return (
      <p className="text-sm text-muted-foreground">
        El registro de peso ayunas está disponible los <strong className="text-foreground">domingos</strong> hasta las{" "}
        <strong className="text-foreground">14:00</strong> (hora Madrid).
      </p>
    );
  }

  if (!usuarioAutenticado) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Para guardar el peso dominical necesitas sesión.</p>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href="/login">Ir a iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate aria-label="Registrar peso dominical en biometría">
      <div className="flex flex-col gap-1">
        <label htmlFor="peso_kg" className="text-sm font-medium text-foreground">
          Peso (kg)
        </label>
        <input
          id="peso_kg"
          name="peso_kg"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={defaultPesoText}
          required
          aria-invalid={state.kind === "error"}
          aria-describedby={state.kind === "error" ? "peso_kg_error" : undefined}
          className="h-11 min-h-11 rounded-md border border-border bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive"
          placeholder="ej. 79,4"
        />
      </div>
      <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto" variant="default">
        {pending ? "Guardando…" : "Guardar peso dominical"}
      </Button>
        <div aria-live="polite" className="min-h-5 text-sm">
        {state.kind === "success" ? (
          <p className="text-emerald-400" role="status">
            Guardado: {state.pesoKg} kg · {state.fechaPesaje}
          </p>
        ) : null}
        {state.kind === "error" ? (
          <p id="peso_kg_error" className="text-destructive" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
