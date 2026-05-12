#!/usr/bin/env bash
# Crea/actualiza los Cloud Scheduler jobs que pegan a Cloud Run:
#   - cron-pre-entreno      → 08:50 Europe/Madrid → POST /cron/pre_entreno
#   - cron-resumen-noche    → 23:00 Europe/Madrid → POST /cron/resumen_noche
#   - cron-purga-health-raw → semanal             → POST /cron/purgar_health_raw
#
# Uso: bash scripts/setup_scheduler.sh

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-fitbit-healt-node}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-fitbit-node}"
TZ="Europe/Madrid"

gcloud config set project "${PROJECT_ID}"
SERVICE_URL=$(gcloud run services describe "${SERVICE}" --region="${REGION}" --format='value(status.url)')

if [[ -z "${SERVICE_URL}" ]]; then
  echo "[ERROR] No se pudo obtener la URL del servicio ${SERVICE}."
  exit 1
fi
echo "[INFO] Servicio: ${SERVICE_URL}"

crear_o_actualizar() {
  local NAME="$1"
  local SCHEDULE="$2"
  local PATH_HTTP="$3"

  if gcloud scheduler jobs describe "${NAME}" --location="${REGION}" >/dev/null 2>&1; then
    echo "[~] Actualizando ${NAME}"
    gcloud scheduler jobs update http "${NAME}" \
      --location="${REGION}" \
      --schedule="${SCHEDULE}" \
      --time-zone="${TZ}" \
      --uri="${SERVICE_URL}${PATH_HTTP}" \
      --http-method=POST \
      --headers="Content-Type=application/json" \
      --message-body='{}'
  else
    echo "[+] Creando ${NAME}"
    gcloud scheduler jobs create http "${NAME}" \
      --location="${REGION}" \
      --schedule="${SCHEDULE}" \
      --time-zone="${TZ}" \
      --uri="${SERVICE_URL}${PATH_HTTP}" \
      --http-method=POST \
      --headers="Content-Type=application/json" \
      --message-body='{}' \
      --description="Auto-generado por scripts/setup_scheduler.sh"
  fi
}

crear_o_actualizar "cron-pre-entreno"      "50 8 * * *"  "/cron/pre_entreno"
crear_o_actualizar "cron-resumen-noche"    "0 23 * * *"  "/cron/resumen_noche"
crear_o_actualizar "cron-purga-health-raw" "0 4 * * 0"   "/cron/purgar_health_raw"

echo "[OK] Schedulers configurados:"
gcloud scheduler jobs list --location="${REGION}" --format="table(name,schedule,timeZone,state)"
