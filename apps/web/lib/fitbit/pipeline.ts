/**
 * Puntos de extensión (sin efectos en runtime):
 * - Maestro: `FITBIT_ACTIVO=true|1` en servidor; si no, ingest/UI/sync de telemetría quedan apagados.
 * - Ingesta: `POST /api/fitbit/ingest` con cuerpo JSON validado; con maestro activo requiere `FITBIT_INGEST_ENABLED=true`.
 * - Automatización: un cron o webhook externo puede llamar al mismo endpoint; `FITBIT_SYNC_ENABLED`
 *   queda reservado para comprobar en workers propios (no usado aún en esta app).
 * - Claves Fitbit reales no se configuran aquí: el mapeo Google Health / otro origen es externo.
 */
export const FITBIT_INGEST_API_RELATIVE_PATH = "/api/fitbit/ingest" as const;
