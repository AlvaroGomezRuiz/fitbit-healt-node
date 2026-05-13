import type { DiaSemanaDb } from "@/lib/data/rutina-oficial";

export type TrainerHidratacionKind = "limonada" | "coco" | "agua_mineral";

export interface TrainerHidratacionPillMeta {
  readonly kind: TrainerHidratacionKind;
  readonly badge: string;
  readonly title: string;
}

/**
 * Etiqueta de hidrata sugerida por día civil de rutina (gimnasio).
 */
export function trainerHidratacionPillMetaForDia(dia: DiaSemanaDb): TrainerHidratacionPillMeta {
  switch (dia) {
    case "MON":
    case "WED":
    case "THU":
      return {
        kind: "limonada",
        badge: "Limón",
        title: "Limonada — hidratar en sesión",
      };
    case "TUE":
    case "FRI":
      return {
        kind: "coco",
        badge: "Coco",
        title: "Agua de coco — hidratar en sesión",
      };
    case "SAT":
    case "SUN":
      return {
        kind: "agua_mineral",
        badge: "Agua mineral",
        title: "Descanso — hidratar con agua mineral",
      };
    default: {
      const _never: never = dia;
      return _never;
    }
  }
}
