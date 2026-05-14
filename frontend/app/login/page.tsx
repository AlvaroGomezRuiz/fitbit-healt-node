import * as React from "react";

import { LoginMagicForm } from "@/components/features/login-magic-form";
import { SINGLE_USER_PLACEHOLDERS } from "@/lib/ui/single-user-placeholders";

interface LoginPageProps {
  readonly searchParams: Promise<{ readonly error?: string }>;
}

export default async function LoginPage(props: LoginPageProps): Promise<React.ReactElement> {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 p-4" aria-labelledby="login-heading">
      <header className="flex flex-col gap-1">
        <h1 id="login-heading" className="text-xl font-semibold tracking-tight text-foreground">
          Entrar
        </h1>
        <p className="text-sm text-muted-foreground">{SINGLE_USER_PLACEHOLDERS.login.descripcion}</p>
      </header>
      {typeof error === "string" && error.length > 0 ? (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {SINGLE_USER_PLACEHOLDERS.login.errorGenerico}
        </div>
      ) : null}
      <LoginMagicForm />
    </section>
  );
}
