import Link from "next/link";
import * as React from "react";

import { listCronInvocationRecent, listReportRunRecent } from "@/lib/data/cron-debug";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 25;

export default async function DevCronsPage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return (
      <section className="flex flex-col gap-2" aria-labelledby="dev-crons-heading">
        <h1 id="dev-crons-heading" className="text-xl font-semibold tracking-tight text-foreground">
          Crons y trazas LLM
        </h1>
        <p className="text-sm text-muted-foreground">
          No hay cliente Supabase configurado (variables públicas ausentes).
        </p>
      </section>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) {
    return (
      <section className="flex flex-col gap-3" aria-labelledby="dev-crons-heading">
        <h1 id="dev-crons-heading" className="text-xl font-semibold tracking-tight text-foreground">
          Crons y trazas LLM
        </h1>
        <p className="text-sm text-muted-foreground">
          Vista interna solo con sesión iniciada: evita exponer metadatos de ejecución a visitantes anónimos.
        </p>
        <Link
          href="/login"
          prefetch={false}
          className="w-fit rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/70"
        >
          Iniciar sesión
        </Link>
      </section>
    );
  }

  const [reportRuns, crons] = await Promise.all([
    listReportRunRecent({ limit: LIST_LIMIT }),
    listCronInvocationRecent({ limit: LIST_LIMIT }),
  ]);

  return (
    <section className="flex flex-col gap-6" aria-labelledby="dev-crons-heading">
      <header className="flex flex-col gap-1">
        <h1 id="dev-crons-heading" className="text-xl font-semibold tracking-tight text-foreground">
          Crons y trazas LLM
        </h1>
        <p className="text-xs text-muted-foreground">
          Últimas filas de <code className="rounded bg-muted px-1 font-mono text-foreground">report_run</code> y{" "}
          <code className="rounded bg-muted px-1 font-mono text-foreground">cron_invocation</code> (solo lectura,
          depuración).
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">report_run</h2>
        {reportRuns.ok === false ? (
          <p className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive" role="alert">
            {reportRuns.message}
          </p>
        ) : reportRuns.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin filas.</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Últimas ejecuciones report_run">
            {reportRuns.rows.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-border bg-card p-2 font-mono text-[11px] leading-snug text-foreground dark:text-foreground"
              >
                <div className="flex flex-wrap justify-between gap-1 text-muted-foreground">
                  <span>{r.run_at}</span>
                  <span className="text-foreground">{r.report_kind}</span>
                  <span className={r.status === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                    {r.status}
                  </span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  día {r.target_madrid_date ?? "—"} · semana {r.semana_inicio ?? "—"} · {r.model_used || "—"}
                </div>
                <div className="mt-1 text-muted-foreground">
                  tok in/out {r.input_tokens ?? "—"} / {r.output_tokens ?? "—"} · {r.duration_ms ?? "—"} ms
                </div>
                {r.error_message !== null && r.error_message.length > 0 ? (
                  <p className="mt-1 wrap-break-word text-destructive">{r.error_message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">cron_invocation</h2>
        {crons.ok === false ? (
          <p className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive" role="alert">
            {crons.message}
          </p>
        ) : crons.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin filas.</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Últimas invocaciones cron_invocation">
            {crons.rows.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-border bg-card p-2 font-mono text-[11px] leading-snug text-foreground"
              >
                <div className="flex flex-wrap justify-between gap-1">
                  <span className="break-all text-foreground">{c.route_path}</span>
                  <span className="shrink-0 text-muted-foreground">{c.started_at}</span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  HTTP {c.http_status ?? "—"} · {c.duration_ms ?? "—"} ms
                </div>
                {c.error_summary !== null && c.error_summary.length > 0 ? (
                  <p className="mt-1 wrap-break-word text-destructive">{c.error_summary}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
