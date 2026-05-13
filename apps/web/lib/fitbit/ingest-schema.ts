import { z } from "zod";

/**
 * Cuerpo mínimo para upsert manual o pipeline (p. ej. Google Health → map → POST).
 * Columnas no enviadas quedan sin tocar en conflicto según comportamiento de PostgREST;
 * en inserción nueva, el resto queda NULL salvo defaults de la tabla.
 */
export const telemetriaIngestBodySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "fecha debe ser YYYY-MM-DD"),
  pulsera_activa: z.boolean().optional(),
  hrv_diario: z.number().finite().nullable().optional(),
  peso_actual_kg: z.number().finite().nullable().optional(),
  sueno_horas: z.number().finite().nullable().optional(),
  sueno_eficiencia: z.number().finite().nullable().optional(),
  resumen_critico: z.record(z.string(), z.unknown()).optional(),
  snapshot_completo: z.record(z.string(), z.unknown()).optional(),
});

export type TelemetriaIngestBody = z.infer<typeof telemetriaIngestBodySchema>;
