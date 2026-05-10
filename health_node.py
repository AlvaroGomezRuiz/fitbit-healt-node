import os
import datetime
import io
import json
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Request
import uvicorn

# Silenciamos el error de importación si no tienes la librería en local todavía
try:
    from pypdf import PdfReader # pyright: ignore[reportMissingImports]
except ImportError:
    PdfReader = None

from brain_engine import (
    procesar_entrenamiento_llm,
    procesar_telemetria_nativa_api,
    sincronizar_biometria_fit,
    FILE_ID_MAESTRO
)
from drive_engine import (
    leer_estado_maestro,
    volcar_entreno_lyfta,
    volcar_log_sistema,
    actualizar_memoria_lineal
)

app = FastAPI(title="Google Health Premium Edge Node", version="15.2")

def extraer_texto_pdf(file_content: bytes) -> str:
    """Extrae texto de documentos PDF para análisis de historial."""
    if PdfReader is None:
        return "Error: Librería pypdf no instalada en el servidor."
    try:
        reader = PdfReader(io.BytesIO(file_content))
        texto = ""
        for page in reader.pages:
            texto += (page.extract_text() or "") + "\n"
        return texto
    except Exception as e:
        return f"Error al leer PDF: {str(e)}"

def pipeline_lyfta_background(raw_text: str, extension: str):
    """Procesa entrenamientos (JSON, CSV, TXT, PDF) de forma asíncrona."""
    try:
        # 1. Archivar en el Data Lake
        volcar_entreno_lyfta(raw_text)

        # 2. Obtener estado biológico
        estado_actual = leer_estado_maestro(FILE_ID_MAESTRO)

        # 3. Análisis Cognitivo
        procesar_entrenamiento_llm(raw_text, estado_actual, extension)

    except Exception as e:
        error_msg = f"Fallo en pipeline Lyfta: {str(e)}"
        print(f"[CRÍTICO] {error_msg}")
        volcar_log_sistema(error_msg, f"CRASH_LYFTA_{datetime.datetime.now().strftime('%H%M%S')}.txt")

@app.post("/webhook/lyfta_workout")
async def recibir_entreno_lyfta(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """INGESTA UNIVERSAL: Acepta el .txt de tu atajo, PDF, JSON o CSV."""
    content = await file.read()

    # SOLUCIÓN AL ERROR DE LINTER: Manejo seguro del nombre de archivo
    nombre_archivo = file.filename or "entreno.txt"
    if "." in nombre_archivo:
        extension = nombre_archivo.split('.')[-1].lower()
    else:
        extension = "txt"

    if extension == "pdf":
        raw_text = extraer_texto_pdf(content)
    else:
        raw_text = content.decode('utf-8')

    background_tasks.add_task(pipeline_lyfta_background, raw_text, extension)

    return {"status": "accepted", "format_detected": extension, "message": "Procesando entreno..."}

@app.post("/webhook/google_health_api")
async def recibir_webhook_google_health(request: Request, background_tasks: BackgroundTasks):
    try:
        payload = await request.json()
        background_tasks.add_task(procesar_telemetria_background, payload)
        return {"status": "accepted"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def procesar_telemetria_background(payload: dict):
    try:
        procesar_telemetria_nativa_api(payload)
    except Exception as e:
        print(f"Error telemetría: {e}")

@app.post("/cron/diario")
async def daily_sync():
    mutado = sincronizar_biometria_fit()
    return {"mutacion_ejecutada": mutado, "timestamp": datetime.datetime.now().isoformat()}

@app.on_event("startup")
async def startup():
    try:
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        print(f"[SISTEMA] V15 ONLINE | Usuario: {estado['biometria_actual']['peso_kg']}kg")
    except Exception:
        print("[ALERTA] Error de enlace con Drive")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
