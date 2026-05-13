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

/** Tras upsert lista compra / menú en `memoria_ia`. */
export function revalidateAfterSundayShoppingWrite(): void {
  revalidateAppPage("/nutrition");
}

/** Tras upsert en `telemetria_diaria` (ingesta Fitbit u otra telemetría). */
export function revalidateAfterTelemetriaDiariaWrite(): void {
  revalidateAppPage("/nutrition");
  revalidateAppPage("/");
}
