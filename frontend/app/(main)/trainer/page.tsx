import * as React from "react";

import { WorkoutDb03RecentBlock } from "@/components/features/entreno/workout-db03-recent";
import { LyftaIngestForm } from "@/components/features/lyfta-ingest-form";
import { EntrenosHistorialTrainerBlock, PostEntrenoTrainerBlock } from "@/components/features/trainer-page-blocks";
import { listEntrenosHistoricoRecent } from "@/lib/data/entrenos-historico";
import { fetchRutinaOficial } from "@/lib/data/rutina-oficial";
import type { DiaSemanaDb } from "@/lib/data/rutina-oficial";
import { listReportesHtmlByTipoRecent } from "@/lib/data/reportes-html";
import { listWorkoutSessionsRecent } from "@/lib/data/workout-session-recent";
import { trainerHidratacionPillMetaForDia } from "@/lib/data/trainer-hidratacion";
import { SINGLE_USER_PLACEHOLDERS } from "@/lib/ui/single-user-placeholders";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function HidratacionPill({ dia }: { readonly dia: DiaSemanaDb }): React.ReactElement {
  const meta = trainerHidratacionPillMetaForDia(dia);
  return (
    <span
      title={meta.title}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        meta.kind === "limonada" && "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
        meta.kind === "coco" && "border-cyan-500/40 bg-cyan-500/10 text-cyan-950 dark:text-cyan-100",
        meta.kind === "agua_mineral" &&
          "border-slate-500/40 bg-slate-500/10 text-slate-900 dark:text-slate-100",
      )}
    >
      {meta.badge}
    </span>
  );
}

export default async function TrainerPage(): Promise<React.ReactElement> {
  const [rutina, postEntreno, historial, workoutDb03] = await Promise.all([
    fetchRutinaOficial(),
    listReportesHtmlByTipoRecent({ tipo: "POST_ENTRENO", limit: 8 }),
    listEntrenosHistoricoRecent({ limit: 18 }),
    listWorkoutSessionsRecent({ limit: 12 }),
  ]);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="trainer-heading">
      <header className="flex flex-col gap-1">
        <h1 id="trainer-heading" className="text-xl font-semibold tracking-tight text-foreground">
          Entreno
        </h1>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>
            Rutina oficial semanal y pegado de sesión Lyfta: analizar, guardar en historial y, si lo necesitas,
            resumen con IA.
          </p>
          <p>Informes post-entreno recientes e historial de entrenos ya registrados.</p>
        </div>
      </header>

      <RutinaPanel result={rutina} />

      <LyftaIngestForm />

      <WorkoutDb03RecentBlock result={workoutDb03} />

      <PostEntrenoTrainerBlock reportes={postEntreno} />

      <EntrenosHistorialTrainerBlock historial={historial} />
    </section>
  );
}

function RutinaPanel({
  result,
}: {
  readonly result: Awaited<ReturnType<typeof fetchRutinaOficial>>;
}): React.ReactElement {
  if (!result.ok) {
    if (result.code === "missing_env") {
      return (
        <div
          className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-100"
          role="status"
        >
          <p className="font-medium">Sin conexión al almacén</p>
          <p className="mt-1 text-muted-foreground">{SINGLE_USER_PLACEHOLDERS.entrenador.sinAlmacen}</p>
        </div>
      );
    }
    if (
      result.code === "query_error" &&
      result.message.includes("no es la de la API")
    ) {
      return (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-50"
          role="status"
        >
          <p className="font-medium text-amber-900 dark:text-amber-100">
            URL de proyecto incorrecta
          </p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            Corrige la URL pública del almacén de datos en{" "}
            <code className="rounded bg-black/10 px-1 font-mono dark:bg-white/15">frontend/.env.local</code> o en las
            variables del despliegue del proyecto web y vuelve a cargar.
          </p>
        </div>
      );
    }
    return (
      <div
        className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        role="alert"
      >
        <p className="font-medium">No se pudo leer la rutina</p>
        <p className="mt-1 text-muted-foreground">{SINGLE_USER_PLACEHOLDERS.entrenador.rutinaNoDisponible}</p>
      </div>
    );
  }
  if (result.rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground" role="status">
        {SINGLE_USER_PLACEHOLDERS.entrenador.rutinaVacia}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-foreground">Rutina oficial</h2>
      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
        {result.rows.map((row) => (
          <li key={row.dia} className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-foreground">{row.dia}</span>
            <span className="text-foreground">{row.nombre_dia}</span>
            <HidratacionPill dia={row.dia} />
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">{row.grupo_sesion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
