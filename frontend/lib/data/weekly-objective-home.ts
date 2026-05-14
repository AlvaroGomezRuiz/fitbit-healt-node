import "server-only";

import { z } from "zod";

import { mondayOfWeekMadridIso } from "@/lib/data/date-madrid";
import { publicSupabaseQueryFailureMessage } from "@/lib/supabase/public-query-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const weeklyObjectiveRowSchema = z.object({
  semana_inicio: z.string(),
  target_weight_kg: z.coerce.number().nullable(),
  notes: z.string().nullable(),
});

const weeklyPrTargetRowSchema = z.object({
  exercise_name: z.string(),
  target_weight_kg: z.coerce.number(),
  target_reps: z.coerce.number(),
  priority: z.coerce.number(),
});

export interface WeeklyObjectiveHomeData {
  readonly semanaInicio: string;
  readonly semanaInicioLegible: string;
  readonly targetWeightKg: number | null;
  readonly notes: string | null;
  readonly prTargets: readonly {
    readonly exerciseName: string;
    readonly weightKg: number;
    readonly reps: number;
  }[];
}

export type HomeWeeklyObjectiveBlock =
  | { readonly state: "ok"; readonly data: WeeklyObjectiveHomeData }
  | { readonly state: "empty" }
  | { readonly state: "error"; readonly message: string };

function buildSemanaLegible(semanaInicio: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(new Date(`${semanaInicio}T12:00:00.000Z`));
}

/**
 * Objetivos de la semana civil Madrid (fila por lunes + PRs). Si la tabla no existe aún en remoto, devuelve `empty`.
 */
export async function fetchWeeklyObjectiveHome(fechaCivilMadrid: string): Promise<HomeWeeklyObjectiveBlock> {
  const supabase = await createSupabaseServerClient();
  if (supabase === null) {
    return { state: "empty" };
  }
  const semanaInicio = mondayOfWeekMadridIso(fechaCivilMadrid);
  try {
    const objRes = await supabase
      .from("weekly_objective")
      .select("semana_inicio, target_weight_kg, notes")
      .eq("semana_inicio", semanaInicio)
      .maybeSingle();
    if (objRes.error !== null) {
      const msg = objRes.error.message.toLowerCase();
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        return { state: "empty" };
      }
      return { state: "error", message: publicSupabaseQueryFailureMessage(objRes.error.message) };
    }
    if (objRes.data === null) {
      return { state: "empty" };
    }
    const parsedObj = weeklyObjectiveRowSchema.safeParse(objRes.data);
    if (!parsedObj.success) {
      return { state: "error", message: "Formato inesperado en weekly_objective." };
    }

    const prRes = await supabase
      .from("weekly_pr_target")
      .select("exercise_name, target_weight_kg, target_reps, priority")
      .eq("semana_inicio", semanaInicio)
      .order("priority", { ascending: false });
    if (prRes.error !== null) {
      const msg = prRes.error.message.toLowerCase();
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        return { state: "empty" };
      }
      return { state: "error", message: publicSupabaseQueryFailureMessage(prRes.error.message) };
    }
    const rawPrs = prRes.data ?? [];
    const prTargets: Array<{
      readonly exerciseName: string;
      readonly weightKg: number;
      readonly reps: number;
    }> = [];
    for (const row of rawPrs) {
      const p = weeklyPrTargetRowSchema.safeParse(row);
      if (p.success) {
        prTargets.push({
          exerciseName: p.data.exercise_name,
          weightKg: p.data.target_weight_kg,
          reps: p.data.target_reps,
        });
      }
    }

    const o = parsedObj.data;
    return {
      state: "ok",
      data: {
        semanaInicio: o.semana_inicio,
        semanaInicioLegible: buildSemanaLegible(o.semana_inicio),
        targetWeightKg: o.target_weight_kg,
        notes: o.notes,
        prTargets,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer objetivos semanales.";
    return { state: "error", message: publicSupabaseQueryFailureMessage(message) };
  }
}
