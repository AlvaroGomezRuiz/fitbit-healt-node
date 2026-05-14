import { revalidatePath } from "next/cache";

/**
 * Invalida solo la página (no todo el layout) tras escrituras Supabase visibles en UI.
 */
function revalidateAppPage(path: "/trainer" | "/" | "/nutrition"): void {
  revalidatePath(path, "page");
}

/** Tras upsert en `entrenos_historico` (Lyfta u orígenes equivalentes). */
export function revalidateAfterEntrenosHistoricoWrite(): void {
  revalidateAppPage("/trainer");
  revalidateAppPage("/");
}

/** Tras upsert en `diario_plan_ia` (plan nutrición diario). */
export function revalidateAfterDiarioPlanIaWrite(): void {
  revalidateAppPage("/nutrition");
}

/** Tras upsert en `reportes_html` tipo pre-entreno. */
export function revalidateAfterPreEntrenoReportWrite(): void {
  revalidateAppPage("/trainer");
}

/** Tras upsert en `reportes_html` tipo post-entreno (dashboard / trainer). */
export function revalidateAfterPostEntrenoReportWrite(): void {
  revalidateAppPage("/trainer");
  revalidateAppPage("/");
}

/** Tras upsert lista compra / menú en `memoria_ia`. */
export function revalidateAfterSundayShoppingWrite(): void {
  revalidateAppPage("/nutrition");
}

/** Tras upsert en `telemetria_diaria` (ingesta Fitbit u otra telemetría). */
export function revalidateAfterTelemetriaDiariaWrite(): void {
  revalidateAppPage("/nutrition");
  revalidateAppPage("/");
}

/** Tras actualizar `biometria_maestro` (p. ej. peso dominical). */
export function revalidateAfterBiometriaMaestroWrite(): void {
  revalidateAppPage("/");
}

/** Tras escribir tablas DB-06 de nutrición (compra, menú, memoria, prohibidos). */
export function revalidateAfterNutritionWeekTablesWrite(): void {
  revalidateAppPage("/nutrition");
}
