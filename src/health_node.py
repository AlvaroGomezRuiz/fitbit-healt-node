import os
import datetime
import io
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Request
import uvicorn

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

# Importaciones desde el motor de inteligencia
from brain_engine import (
    procesar_entrenamiento_llm,
    procesar_telemetria_nativa_api,
    extraer_metadatos_entreno,
    generar_resumen_pre_entreno,
    evaluar_mutacion_estado
)

# Importaciones desde el motor de persistencia
from drive_engine import (
    leer_estado_maestro,
    actualizar_estado_maestro,
    volcar_archivo_raw,
    volcar_log_sistema
)

app = FastAPI(title="Google Health Premium Node - Core")

def extraer_texto_pdf(file_content: bytes) -> str:
    """Decodificación vectorial segura de archivos Lyfta PDF."""
    if PdfReader is None:
        return "Error crítico: pypdf no cargado."
    try:
        reader = PdfReader(io.BytesIO(file_content))
        return "\n".join([page.extract_text() or "" for page in reader.pages])
    except Exception as e:
        return f"Fallo en decodificación PDF: {str(e)}"

def pipeline_entrenamiento_completo(content: bytes, extension: str, raw_text: str):
    """Canalización asíncrona de ingesta de datos con validación de entorno."""
    try:
        file_id_maestro = os.environ.get("FILE_ID_MAESTRO")
        if not file_id_maestro:
            raise RuntimeError("FILE_ID_MAESTRO no inyectado en el entorno.")

        fecha_dt, tipo_rutina = extraer_metadatos_entreno(raw_text)
        volcar_archivo_raw(content, extension, fecha_dt, tipo_rutina)

        # 1. Lectura del estado biométrico actual
        estado_actual = leer_estado_maestro(file_id_maestro)

        # 2. Motor de Autonomía
        nuevo_estado = evaluar_mutacion_estado(raw_text, estado_actual)

        # 3. Mutación de estado en Drive
        if nuevo_estado != estado_actual:
            actualizar_estado_maestro(file_id_maestro, nuevo_estado)
            estado_actual = nuevo_estado
            volcar_log_sistema(f"[{fecha_dt.isoformat()}] JSON Maestro actualizado autónomamente.", "03_MOTOR_IA_LOGS.txt")

        # 4. Generación de reporte LLM
        procesar_entrenamiento_llm(raw_text, estado_actual, extension)

    except Exception as e:
        volcar_log_sistema(f"Fallo Pipeline: {str(e)}", f"ERR_{datetime.datetime.now().strftime('%H%M%S')}.txt")

# --- ENDPOINTS DE PRODUCCIÓN ---

@app.post("/webhook/lyfta_workout")
async def recibir_entreno_lyfta(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Receptor primario de cargas mecánicas."""
    content = await file.read()
    filename = file.filename if file.filename else "entreno.txt"
    ext = filename.split('.')[-1].lower() if '.' in filename else 'txt'

    try:
        raw_text = extraer_texto_pdf(content) if ext == "pdf" else content.decode('utf-8')
    except Exception:
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
    DISPARADOR MAESTRO.
    Activa el análisis de preparación (Readiness) evaluando fatiga del SNC.
    """
    background_tasks.add_task(generar_resumen_pre_entreno)
    return {
        "status": "procesando_readiness_SNC",
        "timestamp": datetime.datetime.now().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
