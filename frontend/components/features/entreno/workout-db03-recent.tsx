import * as React from "react";

import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import type { ListWorkoutSessionsRecentResult } from "@/lib/data/workout-session-recent";

export interface WorkoutDb03RecentBlockProps {
  readonly result: ListWorkoutSessionsRecentResult;
}

export function WorkoutDb03RecentBlock({ result }: WorkoutDb03RecentBlockProps): React.ReactElement {
  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="workout-db03-title">
      <h2 id="workout-db03-title" className="text-sm font-semibold text-foreground">
        Sesiones Lyfta (DB-03)
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Vista de la tabla estructurada de sesión y sus líneas de serie. Requiere la migración DB-03 aplicada en Supabase.
      </p>
      {!result.ok ? (
        <div className="mt-2">
          <EmptyNote>{friendlyQueryMessage(result.message)}</EmptyNote>
        </div>
      ) : result.rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Aún no hay filas (o la tabla no existe en remoto).</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {result.rows.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-background/50 px-2 py-1.5">
              <p className="font-medium text-foreground">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono text-foreground">{r.session_date}</span> · {r.grupo} ·{" "}
                <span className="text-[0.65rem] text-muted-foreground/90">{r.id.slice(0, 8)}…</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
