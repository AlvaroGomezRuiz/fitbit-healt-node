import os
import datetime
import io
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Request
import uvicorn

try:
    from pypdf import PdfReader # pyright: ignore[reportMissingImports]
except ImportError:
    PdfReader = None

# Importaciones desde el motor de inteligencia (Actualizadas a la nueva arquitectura)
from brain_engine import (
    procesar_entrenamiento_llm,
    procesar_telemetria_nativa_api,
    extraer_metadatos_entreno,
    generar_resumen_pre_entreno,
    evaluar_mutacion_estado, # <-- NUEVO: Motor de Autonomía
    FILE_ID_MAESTRO
)

# Importaciones desde el motor de persistencia (TXT Nativo)
from drive_engine import (
    leer_estado_maestro,
    actualizar_estado_maestro, # <-- NUEVO: Capacidad de re-escribir tu JSON
    volcar_archivo_raw,
    volcar_log_sistema
)

app = FastAPI(title="Google Health Premium Node - Core")

def extraer_texto_pdf(file_content: bytes) -> str:
    """Decodificación vectorial segura de archivos Lyfta PDF."""
    if PdfReader is None: return "Error crítico: pypdf no cargado."
    try:
        reader = PdfReader(io.BytesIO(file_content))
        return "\n".join([page.extract_text() or "" for page in reader.pages])
    except: return "Fallo en decodificación PDF."

def pipeline_entrenamiento_completo(content: bytes, extension: str, raw_text: str):
    """Canalización asíncrona de ingesta de datos mecánicos y análisis con autonomía total."""
    try:
        fecha_dt, tipo_rutina = extraer_metadatos_entreno(raw_text)
        volcar_archivo_raw(content, extension, fecha_dt, tipo_rutina)

        # 1. Leemos cómo estabas ayer
        estado_actual = leer_estado_maestro(FILE_ID_MAESTRO)

        # 2. AUTONOMÍA PLENA: La IA decide si has cambiado de peso o biometría
        nuevo_estado = evaluar_mutacion_estado(raw_text, estado_actual)

        # 3. Si detecta un cambio, sobrescribe el archivo maestro en Drive silenciosamente
        if nuevo_estado != estado_actual:
            actualizar_estado_maestro(FILE_ID_MAESTRO, nuevo_estado)
            estado_actual = nuevo_estado # Usamos el nuevo estado para el análisis de hoy
            volcar_log_sistema(f"[{fecha_dt.isoformat()}] JSON Maestro actualizado autónomamente.", "03_MOTOR_IA_LOGS.txt")

        # 4. Genera tu Google Doc bonito usando tus datos 100% actualizados
        procesar_entrenamiento_llm(raw_text, estado_actual, extension)

    except Exception as e:
        # Volcado de errores directo a Drive en .txt
        volcar_log_sistema(f"Fallo Pipeline: {str(e)}", f"ERR_{datetime.datetime.now().strftime('%H%M%S')}.txt")

# --- ENDPOINTS DE PRODUCCIÓN ---

@app.post("/webhook/lyfta_workout")
async def recibir_entreno_lyfta(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Receptor primario de cargas mecánicas (Archivos de Lyfta)."""
    content = await file.read()
    filename = file.filename if file.filename else "entreno.txt"
    ext = filename.split('.')[-1].lower() if '.' in filename else 'txt'

    try:
        raw_text = extraer_texto_pdf(content) if ext == "pdf" else content.decode('utf-8')
    except:
        raw_text = "Contenido no decodificable."

    background_tasks.add_task(pipeline_entrenamiento_completo, content, ext, raw_text)
    return {"status": "ingesta_aceptada"}

@app.post("/webhook/google_health_api")
async def recibir_telemetria(request: Request, background_tasks: BackgroundTasks):
    """Receptor de telemetría genérica de la API."""
    payload = await request.json()
    background_tasks.add_task(procesar_telemetria_nativa_api, payload)
    return {"status": "telemetria_en_proceso"}

# --- ENDPOINTS DE AUTOMATIZACIÓN (CRON) ---

@app.post("/cron/resumen_matutino")
async def endpoint_resumen_matutino(background_tasks: BackgroundTasks):
    """
    DISPARADOR MAESTRO DE LAS 08:50 AM.
    Activa el análisis de preparación (Readiness) descargando HRV y Sueño de la Fitbit Air.
    """
    background_tasks.add_task(generar_resumen_pre_entreno)
    return {
        "status": "procesando_readiness_SNC",
        "timestamp": datetime.datetime.now().isoformat()
    }

if __name__ == "__main__":
    # Configuración de puerto dinámica para Google Cloud Run
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
