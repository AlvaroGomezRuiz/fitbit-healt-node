# Fitbit Air → Google Health Node

Nodo de telemetría de salud auto-hospedado en **Google Cloud Run** que:

- Lee los **31 data types** de la nueva **Google Health API v4** (Fitbit Air, Charge 6, etc.).
- Recibe entrenos de la app **Lyfta** vía webhook (atajo iOS).
- Audita PRE-ENTRENO / POST-ENTRENO / RESUMEN-NOCHE con **Gemini 3.1 Pro + Flash** (cascada anti-rate-limit de 7 modelos).
- Persiste todo en tu Google Drive con jerarquía `AÑO/MES/DD_MM_YYYY/`.
- Muta el JSON biométrico maestro de forma **validada por Pydantic**.
- Aplica **5 guardarraíles clínicos duros** sobre cualquier recomendación del LLM.

URL en producción: `https://fitbit-node-443224698452.europe-west1.run.app`

---

## Qué se sube a GitHub y qué NO

### ✅ SÍ se sube (código, configuración pública)

```
.dockerignore           Reglas de exclusión para la imagen Docker
.gitignore              Reglas de exclusión para Git
.env.example            Plantilla de variables (sin valores reales)
Dockerfile              Build de la imagen de Cloud Run
README.md               Este documento
requirements.txt        Dependencias Python
scripts/                Bootstrap, deploy y herramientas de operación
src/                    Código de la aplicación (FastAPI + engines)
```

### ⛔ NUNCA se sube (bloqueado por `.gitignore`)

| Ruta | Por qué |
|---|---|
| `.env` | Contiene `GEMINI_API_KEY`, `GOOGLE_OAUTH_TOKEN_JSON`, `ADMIN_TOKEN`, IDs privados de Drive |
| `token.json` | Refresh token OAuth de Google → acceso total a tu Health + Drive |
| `secrets/credenciales_oauth.json` | Client ID + Client Secret del proyecto Google Cloud |
| `secrets/` (cualquier otro archivo) | Carpeta entera ignorada |
| `venv/`, `__pycache__/` | Entorno virtual y caché Python |
| `.vscode/`, `.idea/` | Config local del IDE |
| `debug_drive/` | Descargas locales para depuración |
| `*.log` | Logs locales |

> En producción los secretos viven en **Google Secret Manager** y se montan en
> Cloud Run como variables de entorno; nunca quedan en disco ni en la imagen.

---

## Runbook de despliegue (de cero a producción)

### 0. Pre-requisitos

| Item | Cómo verificar |
|---|---|
| Google Cloud project | `gcloud projects list` → `fitbit-healt-node` |
| Health API + Drive habilitadas | Console → APIs & Services → Library |
| Email añadido como **test user** | Console → APIs → OAuth consent → Audience |
| `secrets/credenciales_oauth.json` presente | Desktop OAuth Client ID descargado |
| `gcloud CLI` + `bash` (WSL en Windows) | `gcloud --version` |

### 1. Bootstrap local (UNA SOLA VEZ)

```powershell
# Entorno
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Copia plantilla y rellena (al menos GEMINI_API_KEY al principio)
copy .env.example .env

# 1.1 Genera token.json (abre tu navegador, autoriza tu Gmail real)
python -m scripts.oauth_setup
# → escribe token.json en la raíz. Pega su contenido en una línea
#   en GOOGLE_OAUTH_TOKEN_JSON dentro de .env.

# 1.2 Inicializa BIOMETRIA_MAESTRO.json en Drive
python -m scripts.seed_drive --bootstrap-json
# → copia el FILE_ID que imprime a FILE_ID_MAESTRO en .env.

# 1.3 Sube el CSV histórico de entrenos a 00_CONTEXTO_HISTORICO/
python -m scripts.seed_drive --upload-csv

# 1.4 Genera PERFIL_ATLETA.md analizando el CSV (Gemini 3.1)
python -m scripts.seed_drive --generar-perfil
```

### 2. Crear secretos en Secret Manager

```bash
gcloud config set project fitbit-healt-node

gcloud secrets create google-oauth-token --data-file=./token.json
echo -n "AIzaSy_TU_GEMINI_KEY" | gcloud secrets create gemini-api-key --data-file=-
echo -n "$(uuidgen)"           | gcloud secrets create admin-token    --data-file=-

# Da permiso al service account de Cloud Run para leer secretos
gcloud projects add-iam-policy-binding fitbit-healt-node \
  --member="serviceAccount:443224698452-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Deploy a Cloud Run

```bash
bash scripts/deploy_cloudrun.sh
```

Imprime al final la URL `https://fitbit-node-...run.app`.

### 4. Programar los crons

```bash
bash scripts/setup_scheduler.sh
```

Crea:

| Job | Cuándo | Endpoint |
|---|---|---|
| `cron-pre-entreno` | 08:50 Europe/Madrid diario | `POST /cron/pre_entreno` |
| `cron-resumen-noche` | 23:00 Europe/Madrid diario | `POST /cron/resumen_noche` |
| `cron-purga-health-raw` | Domingos 04:00 | `POST /cron/purgar_health_raw` |

### 5. Conectar el atajo iOS de Lyfta (dispara POST-ENTRENO)

`POST` multipart al endpoint:

```
https://fitbit-node-443224698452.europe-west1.run.app/webhook/lyfta_workout
```

con campo `file` = el TXT/PDF del entreno. La respuesta llega en 15-60 s
(tras cascada Gemini); el atajo iOS tolera hasta 2 min.

### 6. (Opcional) Suscribir webhooks de Google Health API

```bash
ENDPOINT_URI="https://fitbit-node-443224698452.europe-west1.run.app/webhook/health_push"

curl -X POST "https://health.googleapis.com/v4/projects/fitbit-healt-node/subscribers" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d "{\"endpointUri\":\"${ENDPOINT_URI}\",\"dataTypes\":[\"sleep\",\"daily-heart-rate-variability\",\"steps\",\"weight\"]}"
```

---

## Endpoints

| Método | Path | Para qué |
|---|---|---|
| `GET`  | `/` | Banner del servicio |
| `GET`  | `/health` | Liveness probe (no usar `/healthz`, GFE de Google lo intercepta) |
| `POST` | `/cron/pre_entreno` | Reporte PRE-ENTRENO (Cloud Scheduler 08:50) |
| `POST` | `/cron/resumen_noche` | Reporte resumen del día (Cloud Scheduler 23:00) |
| `POST` | `/cron/purgar_health_raw` | Borra `04_HEALTH_RAW/*.json` > 120 días |
| `POST` | `/webhook/lyfta_workout` | Atajo iOS sube TXT/PDF → dispara POST-ENTRENO |
| `POST` | `/webhook/health_push` | Push de Google Health API |
| `POST` | `/admin/seed` | Re-genera `PERFIL_ATLETA.md`. Header `X-Admin-Token: $ADMIN_TOKEN` |

---

## Estructura del Drive resultante

```
FOLDER_SALUD/  (1s2GSGjlxChGy39jUxJFDiijBCWKKg-T5)
├── BIOMETRIA_MAESTRO.json
├── 00_CONTEXTO_HISTORICO/
│   ├── ENTRENOS_ALVARO_GOMEZ_RUIZ.csv
│   └── PERFIL_ATLETA.md
├── 2026/
│   ├── 05_MAYO/
│   │   ├── 12_05_2026/ … 31_05_2026/
│   │   │   ├── 01_LYFTA_RAW/       ← TXT/PDF crudos del entreno
│   │   │   ├── 02_RESUMEN_DIARIO_IA/ ← HTMLs PRE/POST/NOCHE
│   │   │   ├── 03_MOTOR_IA_LOGS/   ← Logs del motor + errores LLM
│   │   │   └── 04_HEALTH_RAW/      ← JSON crudos Health API (31 types)
│   │   ├── HISTORICO_IA_MAYO_2026.txt   ← Memoria mes para la IA
│   │   └── DIARIO_ALVARO_MAYO_2026.html ← Resumen mes para humano
│   └── DIARIO_ALVARO_2026.html
└── 2027/ …
```

Retención: `04_HEALTH_RAW/*.json` se purga a los **120 días**. Todo lo demás se conserva indefinidamente.

---

## Estructura del código

```
src/
├── auth.py                 OAuth cache + cálculo edad dinámico (FECHA_NACIMIENTO)
├── models.py               Esquema Pydantic BIOMETRIA_MAESTRO
├── health_node.py          FastAPI app (entrypoint Cloud Run)
└── engines/
    ├── health_engine.py    Cliente health.googleapis.com/v4 (31 data types) + circuit-breaker
    ├── drive_engine.py     Persistencia AÑO/MES/DD_MM_YYYY + retención 120d
    └── brain_engine.py     Cascada Gemini 3.1 + 3 reportes + mutación validada Pydantic

scripts/
├── oauth_setup.py          Bootstrap OAuth (UNA VEZ en local)
├── seed_drive.py           Inicialización JSON maestro + CSV + perfil
├── deploy_cloudrun.sh      Despliegue a Cloud Run
├── setup_scheduler.sh      Configurar Cloud Scheduler
├── test_gemini.py          Diagnóstico de la GEMINI_API_KEY (prueba 4 modelos)
└── verificar_dia_actual.py Inspección del día actual en Drive
```

---

## Cascada de modelos Gemini (anti-rate-limit)

`brain_engine.py` define dos cadenas. Si un modelo da 429 / 404 / 5xx,
salta al siguiente sin bloquear el reporte:

**CADENA_COMPLEJA** (reportes PRE/POST/NOCHE, perfil, mutación biométrica):
1. `GEMINI_MODEL_COMPLEX` (`gemini-3.1-pro-preview`)
2. `gemini-3-pro-preview`
3. `gemini-pro-latest`
4. `gemini-2.5-pro`
5. `gemini-2.5-flash`
6. `gemini-2.5-flash-lite`

**CADENA_SIMPLE** (extracción metadatos del TXT de Lyfta):
1. `GEMINI_MODEL_SIMPLE` (`gemini-3.1-flash-lite`)
2. `gemini-3-flash-preview`
3. `gemini-flash-latest`
4. `gemini-2.5-flash`
5. `gemini-2.5-flash-lite`

---

## Guardarraíles clínicos (codificados en `brain_engine.GUARDARRAILES_DOC`)

1. HRV cae > 15 % vs baseline 7d durante 3 días → deload + 200 kcal extra.
2. Pérdida > 1.0 kg/semana sostenida 2 sem → reducir déficit a -250 kcal.
3. TOP_SET cae > 10 % en mismo ejercicio 2 sesiones → bandera roja + 2.8 g/kg proteína.
4. Sueño < 6 h durante 3 días → posponer LEG day, sustituir por PULL ligero.
5. RPE ≥ 9 en 2 sesiones con HRV plano → subir carbos a 220 g (rebote glucógeno).

---

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `404` en `/health` de Cloud Run | Estás golpeando `/healthz` (GFE lo intercepta) | Usa `/health` |
| `403` en `/cron/*` desde Scheduler | Cloud Run no es `--allow-unauthenticated` | Redeploy con flag, o añade `--oidc-service-account-email` al job |
| `RuntimeError: GOOGLE_OAUTH_TOKEN_JSON no inyectado` | Secret no montado en Cloud Run | `gcloud run services describe fitbit-node --region=europe-west1 \| grep -i secret` |
| `404 model not found` en Gemini | Modelo de la primera cadena no existe en tu región | Automático: cae a los 5 siguientes. Comprueba con `python -m scripts.test_gemini` |
| `429 quota exceeded` en todos los modelos | Free tier agotado o trial caducado | Espera a reset diario o activa billing real |
| HTML del reporte sale vacío / 472 bytes | Toda la cadena LLM falló (truncación o filter) | Mira `03_MOTOR_IA_LOGS/ERR_LLM_TOTAL_*.txt` en Drive |
| Mutación biométrica no se aplica | LLM devolvió JSON que viola Pydantic | Mira `03_MOTOR_IA_LOGS/ERR_MUTACION_SCHEMA_*.txt` |
| Cron pre_entreno tarda > 2 min y devuelve 503 | Snapshot Health API serializado con timeouts (sin pulsera) | El circuit-breaker de `health_engine.snapshot_diario_completo` debe cortar tras la primera 4xx. Si no, revisa logs |

---

## Operación diaria (qué hacer cuando todo está en marcha)

**Nada.** El sistema corre sólo. Métricas que merece la pena vigilar:

- `gcloud run services logs read fitbit-node --region=europe-west1 --limit=50`
- `gcloud scheduler jobs list --location=europe-west1`
- Carpeta del día en Drive (`12_05_2026/02_RESUMEN_DIARIO_IA/`) debería tener
  3 HTMLs (PRE, POST, NOCHE) al final del día.

Para diagnóstico rápido:

```powershell
python -m scripts.verificar_dia_actual    # inspecciona el día actual en Drive
python -m scripts.test_gemini             # confirma que la API key responde
```
