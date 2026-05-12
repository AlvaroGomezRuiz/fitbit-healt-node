#!/usr/bin/env bash
# Deploy del servicio fitbit-node a Cloud Run en europe-west1.
# Ejecuta desde la raíz del repo: bash scripts/deploy_cloudrun.sh

set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────
PROJECT_ID="${PROJECT_ID:-fitbit-healt-node}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-fitbit-node}"
SECRET_OAUTH="google-oauth-token"
SECRET_DEEPSEEK="deepseek-api-key"
SECRET_ADMIN="admin-token"

# ── Variables públicas del runtime (Drive IDs + identidad atleta) ───
FOLDER_SALUD_ID="${FOLDER_SALUD_ID:-1s2GSGjlxChGy39jUxJFDiijBCWKKg-T5}"
FILE_ID_MAESTRO="${FILE_ID_MAESTRO:-17ZGn8otBiRN9dgSo6WyoDV1h_d1WwXPp}"
FECHA_NACIMIENTO="${FECHA_NACIMIENTO:-2007-03-05}"
ALTURA_CM="${ALTURA_CM:-160}"
PESO_KG_INICIAL="${PESO_KG_INICIAL:-82}"
DEEPSEEK_MODEL_COMPLEX="${DEEPSEEK_MODEL_COMPLEX:-deepseek-v4-pro}"
DEEPSEEK_MODEL_SIMPLE="${DEEPSEEK_MODEL_SIMPLE:-deepseek-v4-flash}"

# KILL SWITCH del Health API: "false" hasta que llegue la pulsera (26 mayo 2026).
# Cuando llegue, cambiar a "true" con:
#   gcloud run services update fitbit-node --region=europe-west1 \
#     --update-env-vars=FITBIT_ACTIVO=true
FITBIT_ACTIVO="${FITBIT_ACTIVO:-false}"

echo "[1/5] Configurando proyecto ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}"

echo "[2/5] Habilitando APIs necesarias (idempotente)"
# DeepSeek se llama directamente a api.deepseek.com (no necesita habilitar
# servicio GCP). Solo APIs Google que sí usamos.
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  health.googleapis.com \
  drive.googleapis.com

echo "[3/5] Verificando que existen los secretos en Secret Manager"
for s in "${SECRET_OAUTH}" "${SECRET_DEEPSEEK}" "${SECRET_ADMIN}"; do
  if ! gcloud secrets describe "${s}" >/dev/null 2>&1; then
    echo ""
    echo "[ERROR] Falta el secreto '${s}'. Créalo con:"
    case "${s}" in
      "${SECRET_OAUTH}")
        echo "    gcloud secrets create ${s} --data-file=./token.json"
        ;;
      "${SECRET_DEEPSEEK}")
        echo "    echo -n 'sk-TU_DEEPSEEK_API_KEY' | gcloud secrets create ${s} --data-file=-"
        ;;
      "${SECRET_ADMIN}")
        echo "    echo -n \"\$(uuidgen)\" | gcloud secrets create ${s} --data-file=-"
        ;;
    esac
    exit 1
  fi
done

echo "[4/5] Build + deploy con Cloud Build"
gcloud run deploy "${SERVICE}" \
  --source=. \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --timeout=540 \
  --concurrency=4 \
  --min-instances=0 \
  --max-instances=2 \
  --set-env-vars="TZ=Europe/Madrid,FOLDER_SALUD_ID=${FOLDER_SALUD_ID},FILE_ID_MAESTRO=${FILE_ID_MAESTRO},FECHA_NACIMIENTO=${FECHA_NACIMIENTO},ALTURA_CM=${ALTURA_CM},PESO_KG_INICIAL=${PESO_KG_INICIAL},DEEPSEEK_MODEL_COMPLEX=${DEEPSEEK_MODEL_COMPLEX},DEEPSEEK_MODEL_SIMPLE=${DEEPSEEK_MODEL_SIMPLE},FITBIT_ACTIVO=${FITBIT_ACTIVO}" \
  --set-secrets="GOOGLE_OAUTH_TOKEN_JSON=${SECRET_OAUTH}:latest,DEEPSEEK_API_KEY=${SECRET_DEEPSEEK}:latest,ADMIN_TOKEN=${SECRET_ADMIN}:latest"

echo "[5/5] Deploy completo. URL del servicio:"
gcloud run services describe "${SERVICE}" --region="${REGION}" --format='value(status.url)'
