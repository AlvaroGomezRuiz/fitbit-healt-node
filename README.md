# Fitbit Air → Google Health Node

Nodo de telemetría de salud auto-hospedado en **Google Cloud Run** que:

- Lee los **31 data types** de la **Google Health API v4** (Fitbit Air a partir del 26-may-2026).
- Recibe entrenos de la app **Lyfta** vía webhook (atajo iOS).
- Genera **3 reportes/día** (PRE-ENTRENO 08:50, POST-ENTRENO al subir Lyfta, RESUMEN 23:00) con **DeepSeek V4-Pro / V4-Flash**.
- Persiste todo en tu Google Drive con jerarquía `AÑO/MES/DD_MM_YYYY/`.
- Muta el JSON biométrico maestro de forma **validada por Pydantic**.
- Aplica **5 guardarraíles clínicos duros** sobre cualquier recomendación del LLM.

URL de producción: la que devuelva `gcloud run deploy` al final del despliegue (formato `https://fitbit-node-<HASH>-<REGION>.a.run.app`).

---

## App web (fase 3, mock)

Cáscara **Next.js** en `apps/web` (App Router, Tailwind, componentes estilo shadcn). Contenido estático hasta integrar Supabase (fase 1) y DeepSeek (fase 2). Detalle: [docs/phase3-shell.md](docs/phase3-shell.md).

---

## Contenido del repositorio

```
.dockerignore           Exclusiones para la imagen Docker
.gitignore              Exclusiones para Git
.env.example            Plantilla de variables (sin valores reales)
Dockerfile              Build de la imagen de Cloud Run
README.md               Este documento
requirements.txt        Dependencias Python
RUTINA_OFICIAL.md       Rutina vigente (PUSH/PULL/LEG, fuente de verdad para el LLM)
apps/web/               Next.js — cáscara UI fase 3 (mock, ver docs/phase3-shell.md)
docs/                   Documentación auxiliar del repo
scripts/                Bootstrap, deploy y herramientas de operación
src/                    Código de la aplicación (FastAPI + engines)
```

Los **secretos** (API keys, tokens OAuth) y los **datos personales** (CSV histórico, capturas, facturas) están bloqueados por `.gitignore` y nunca llegan al repositorio. En producción los secretos viven en **Google Secret Manager** y se inyectan en Cloud Run como variables de entorno; jamás quedan en disco ni en la imagen Docker.

---

## Runbook de despliegue (de cero a producción)

### 0. Pre-requisitos

| Item | Cómo verificar |
|---|---|
| Google Cloud project | `gcloud projects list` → `fitbit-healt-node` |
| Health API + Drive habilitadas | Console → APIs & Services → Library |
| Email añadido como **test user** | Console → APIs → OAuth consent → Audience |
| `secrets/credenciales_oauth.json` presente | Desktop OAuth Client ID descargado |
| `gcloud` + (opcional) bash | `gcloud --version` |

### 1. Bootstrap local (UNA SOLA VEZ)

```powershell
# Entorno
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Copia plantilla y rellena (al menos DEEPSEEK_API_KEY al principio)
copy .env.example .env

# 1.1  Genera token.json (abre el navegador, autoriza tu Gmail real)
python -m scripts.oauth_setup
# → escribe token.json en la raíz. Pega su contenido en una línea
#   en GOOGLE_OAUTH_TOKEN_JSON dentro de .env.

# 1.2  Inicializa BIOMETRIA_MAESTRO.json en Drive
python -m scripts.crear_maestro_drive
# → imprime el FILE_ID. Copia ese ID a FILE_ID_MAESTRO en .env
#   y al env var de Cloud Run.

# 1.3  Sube CSV histórico + RUTINA_OFICIAL.md + fracciona 140 entrenos
#      en sus carpetas DD_MM_YYYY/01_LYFTA_RAW/, y regenera el perfil.
python -m scripts.actualizar_contexto_drive --regenerar-perfil
```

### 2. Crear secretos en Secret Manager

```bash
gcloud config set project fitbit-healt-node

gcloud secrets create google-oauth-token --data-file=./token.json
echo -n "sk-TU_DEEPSEEK_KEY" | gcloud secrets create deepseek-api-key --data-file=-
echo -n "$(uuidgen)"         | gcloud secrets create admin-token     --data-file=-

# Da permiso al service account de Cloud Run para leer secretos
PROJECT_NUMBER=$(gcloud projects describe fitbit-healt-node --format='value(projectNumber)')
gcloud projects add-iam-policy-binding fitbit-healt-node \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Deploy a Cloud Run

```bash
bash scripts/deploy_cloudrun.sh
```

En Windows sin WSL puedes lanzar el equivalente directo desde PowerShell:

```powershell
gcloud run deploy fitbit-node --source=. --region=europe-west1 `
  --platform=managed --allow-unauthenticated `
  --memory=1Gi --cpu=1 --timeout=540 --concurrency=4 `
  --min-instances=0 --max-instances=2 `
  --set-env-vars="TZ=Europe/Madrid,FOLDER_SALUD_ID=<id>,FILE_ID_MAESTRO=<id>,FECHA_NACIMIENTO=2007-03-05,ALTURA_CM=160,PESO_KG_INICIAL=82,DEEPSEEK_MODEL_COMPLEX=deepseek-v4-pro,DEEPSEEK_MODEL_SIMPLE=deepseek-v4-flash,FITBIT_ACTIVO=false" `
  --set-secrets="GOOGLE_OAUTH_TOKEN_JSON=google-oauth-token:latest,DEEPSEEK_API_KEY=deepseek-api-key:latest,ADMIN_TOKEN=admin-token:latest" `
  --project=fitbit-healt-node
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

### 5. Activar Fitbit Air (cuando llegue, 26-may-2026)

Hasta entonces, el **kill switch** `FITBIT_ACTIVO=false` evita timeouts contra la Health API vacía. El día que enroles la pulsera:

```bash
gcloud run services update fitbit-node \
  --region=europe-west1 --project=fitbit-healt-node \
  --update-env-vars=FITBIT_ACTIVO=true
```

### 6. Conectar el atajo iOS de Lyfta (dispara POST-ENTRENO)

`POST` multipart al endpoint:

```
<TU_URL_CLOUD_RUN>/webhook/lyfta_workout
```

con campo `file` = el TXT/PDF del entreno. Respuesta en 30-180 s; el atajo iOS tolera hasta 2 min.

### 7. (Opcional) Suscribir webhooks de Google Health API

```bash
ENDPOINT_URI="<TU_URL_CLOUD_RUN>/webhook/health_push"

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
| `GET`  | `/health` | Liveness probe (no usar `/healthz`, GFE lo intercepta) |
| `POST` | `/cron/pre_entreno` | Reporte PRE-ENTRENO (Cloud Scheduler 08:50) |
| `POST` | `/cron/resumen_noche` | Reporte resumen del día (Cloud Scheduler 23:00) |
| `POST` | `/cron/purgar_health_raw` | Borra `04_HEALTH_RAW/*.json` > 120 días |
| `POST` | `/webhook/lyfta_workout` | Atajo iOS sube TXT/PDF → dispara POST-ENTRENO |
| `POST` | `/webhook/health_push` | Push de Google Health API |
| `POST` | `/admin/seed` | Re-genera `PERFIL_ATLETA.md`. Header `X-Admin-Token: $ADMIN_TOKEN` |

---

## Estructura del Drive resultante

```
FOLDER_SALUD/  (ID en env var FOLDER_SALUD_ID)
├── 00_CONTEXTO_HISTORICO/
│   ├── BIOMETRIA_MAESTRO.json
│   ├── entrenos_historico.csv             ← CSV agregado de Lyfta
│   ├── PERFIL_ATLETA.md                   ← Generado por DeepSeek-Pro
│   └── RUTINA_OFICIAL.md                  ← Fuente de verdad del entreno
├── 2026/
│   ├── 05_MAYO/
│   │   ├── 12_05_2026/ … 31_05_2026/
│   │   │   ├── 01_LYFTA_RAW/             ← HISTORICO_LYFTA_DD_MM_YYYY.txt + TXT/PDF nuevos
│   │   │   ├── 02_RESUMEN_DIARIO_IA/     ← HTMLs PRE / POST / NOCHE
│   │   │   ├── 03_MOTOR_IA_LOGS/         ← Logs del motor + errores LLM
│   │   │   └── 04_HEALTH_RAW/            ← JSON crudos Health API (31 data types)
│   │   ├── HISTORICO_IA_MAYO_2026.txt    ← Memoria del mes para la IA
│   │   └── DIARIO_<USUARIO>_MAYO_2026.html ← Resumen del mes para humano
│   └── DIARIO_<USUARIO>_2026.html
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
    ├── health_engine.py    Cliente health.googleapis.com/v4 (31 data types) + kill switch FITBIT_ACTIVO
    ├── drive_engine.py     Persistencia AÑO/MES/DD_MM_YYYY + retención 120d
    └── brain_engine.py     Cascada DeepSeek + 3 reportes + mutación validada Pydantic

scripts/
├── oauth_setup.py                 Bootstrap OAuth (UNA VEZ en local)
├── crear_maestro_drive.py         Crea BIOMETRIA_MAESTRO.json (primer arranque o recuperación)
├── actualizar_contexto_drive.py   Refresca todo el contexto: CSV + RUTINA + 140 entrenos + perfil
├── deploy_cloudrun.sh             Despliegue a Cloud Run
├── setup_scheduler.sh             Configurar Cloud Scheduler
├── test_deepseek.py               Diagnóstico de la DEEPSEEK_API_KEY (Pro + Flash)
└── verificar_dia_actual.py        Inspección del día actual en Drive
```

---

## Cascada de modelos DeepSeek V4

`brain_engine.py` define dos cadenas. Si Pro da 5xx / red, cae a Flash. Endpoint OpenAI-compatible: `https://api.deepseek.com/chat/completions`.

**CADENA_COMPLEJA** (reportes PRE/POST/NOCHE, perfil, razonamiento clínico):
1. `DEEPSEEK_MODEL_COMPLEX` (`deepseek-v4-pro`)
2. `deepseek-v4-flash` (fallback rápido)

**CADENA_SIMPLE** (extracción metadatos TXT, mutación JSON estricta):
1. `DEEPSEEK_MODEL_SIMPLE` (`deepseek-v4-flash`)
2. `deepseek-v4-pro` (fallback de calidad)

### Detalle del thinking obligatorio

DeepSeek-V4 **siempre razona internamente** (`reasoning_content`). El parámetro `enable_thinking=false` se acepta pero se ignora en silencio. Por eso `_llamar_modelo` envía `max_tokens` generoso (16384) y `llamar_llm` reintenta una vez con `32768` si el modelo devuelve `content=""` por agotar el budget en reasoning.

### Pricing (mayo 2026, fuente oficial DeepSeek)

| Modelo | Input cache miss | Input cache hit | Output | Context |
|---|---|---|---|---|
| `deepseek-v4-pro` | $1.74 / 1M | $0.003625 / 1M | $0.87 / 1M | 1 M tok |
| `deepseek-v4-flash` | $0.14 / 1M | $0.0028 / 1M | $0.28 / 1M | 1 M tok |

Coste estimado con 3 reportes/día: **~€0.30 – 0.70/mes** (con cache hits frecuentes en bloques estables IDENTIDAD + PERFIL + RUTINA + GUARDARRAILES).

---

## Calendario semanal codificado en `ROTACION_SEMANAL`

| Día | Grupo | Hidratación gym |
|---|---|---|
| Lunes | PULL | Limonada (agua + sal + bicarbonato + zumo limón + edulcorante) |
| Martes | PUSH | Agua de coco |
| Miércoles | LEG | Limonada casera |
| Jueves | PULL | Limonada casera |
| Viernes | PUSH | Agua de coco |
| Sáb / Dom | Descanso | Solo agua mineral |

Suplementación fija: **creatina monohidrato 7 g/día**. Magnesio y Omega-3: pendientes de compra; el LLM no los prescribe hasta nuevo aviso.

Lista de la compra: el LLM **solo la genera los domingos** como resumen semanal de máx 8 viñetas (la compra la gestiona el padre del atleta; el resto de días no se incluye, ahorra ~30 % tokens output).

---

## Guardarraíles clínicos (en `brain_engine.GUARDARRAILES_DOC`)

1. HRV cae > 15 % vs baseline 7 d durante 3 días → deload + 200 kcal extra.
2. Pérdida > 1.0 kg/semana sostenida 2 sem → reducir déficit a -250 kcal.
3. TOP_SET cae > 10 % en mismo ejercicio 2 sesiones → bandera roja + 2.8 g/kg proteína.
4. Sueño < 6 h durante 3 días → posponer LEG day, sustituir por PULL ligero.
5. RPE ≥ 9 en 2 sesiones con HRV plano → subir carbos a 220 g (rebote glucógeno).

---

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `404` en `/health` de Cloud Run | Estás golpeando `/healthz` (GFE lo intercepta) | Usa `/health` |
| `403` en `/cron/*` desde Scheduler | Cloud Run no es `--allow-unauthenticated` | Redeploy con flag |
| `RuntimeError: GOOGLE_OAUTH_TOKEN_JSON no inyectado` | Secret no montado en Cloud Run | `gcloud run services describe fitbit-node --region=europe-west1` |
| `RuntimeError: DEEPSEEK_API_KEY no inyectada` | Secret `deepseek-api-key` no montado | Verifica con `gcloud secrets describe deepseek-api-key` y redeploy |
| `HTTP 401` en DeepSeek | API key inválida (rotada o mal copiada) | Crea una nueva en https://platform.deepseek.com → API Keys |
| `HTTP 402 Insufficient Balance` | Saldo DeepSeek a 0 | Recarga en https://platform.deepseek.com/top_up |
| `status:"fallo"` en 3-4 s y `ERR_MAESTRO.txt` en Drive | `FILE_ID_MAESTRO` apunta a archivo borrado | `python -m scripts.crear_maestro_drive` y actualiza la env var |
| `content=""` con `finish_reason=length` | Reasoning agotó el budget | El retry automático sube a 32768. Si aún falla, revisa `03_MOTOR_IA_LOGS/WARN_LLM_RETRY_*.txt` |
| Cron pre_entreno tarda > 2 min y devuelve 503 | Snapshot Health API serializado con timeouts | Si la pulsera aún no está enrolada, asegúrate de `FITBIT_ACTIVO=false`. El kill switch debe cortar en < 50 ms |

---

## Operación diaria

**Nada.** El sistema corre solo. Métricas que merece la pena vigilar:

```powershell
# Logs recientes
gcloud run services logs read fitbit-node --region=europe-west1 --limit=50 --project=fitbit-healt-node

# Crons activos
gcloud scheduler jobs list --location=europe-west1 --project=fitbit-healt-node

# Inspección rápida de Drive
python -m scripts.verificar_dia_actual

# Smoke test DeepSeek
python -m scripts.test_deepseek
```

La carpeta del día (`12_05_2026/02_RESUMEN_DIARIO_IA/`) debería tener al final del día los HTMLs `01_PRE_ENTRENO_*`, `02_POST_ENTRENO_*` y `03_RESUMEN_NOCHE_*`.

---

## Estado actual (12-may-2026)

- Revisión activa en Cloud Run: `fitbit-node-00067-b95`.
- `FITBIT_ACTIVO=false` (kill switch hasta el enrolado de la pulsera el 26-may-2026).
- Histórico de entrenos cargado desde Lyfta (uno por carpeta `DD_MM_YYYY/01_LYFTA_RAW/`).
- `PERFIL_ATLETA.md` generado por `deepseek-v4-pro` desde el CSV agregado.
- `RUTINA_OFICIAL.md` con la rutina vigente (PUSH/PULL/LEG y triserie de Lateral Raise documentada).
- Smoke test PRE-ENTRENO verde: fecha correcta, hidratación correcta, sin lista de la compra los días no-domingo.
