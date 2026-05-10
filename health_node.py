import os
import datetime
import io
import json
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Request
import uvicorn

# Intentamos importar pypdf para el historial antiguo
try:
    from pypdf import PdfReader # pyright: ignore[reportMissingImports]
except ImportError:
    PdfReader = None

from brain_engine import (
    procesar_entrenamiento_llm,
    procesar_telemetria_nativa_api,
    sincronizar_biometria_fit,
    detectar_fecha_entrenamiento,
    FILE_ID_MAESTRO
)
from drive_engine import (
    leer_estado_maestro,
    volcar_archivo_raw,
    volcar_log_sistema,
    actualizar_memoria_lineal
)

app = FastAPI(title="Google Health Premium Edge Node", version="15.2")

def extraer_texto_pdf(file_content: bytes) -> str:
    """Extrae texto de documentos PDF para procesar historiales antiguos."""
    if PdfReader is None:
        return "Error: pypdf no instalado."
    try:
        reader = PdfReader(io.BytesIO(file_content))
        texto = ""
        for page in reader.pages:
            texto += (page.extract_text() or "") + "\n"
        return texto
    except Exception as e:
        return f"Error leyendo PDF: {str(e)}"

# =====================================================================
# PIPELINES ASÍNCRONOS
# =====================================================================

def pipeline_lyfta_background(content: bytes, extension: str, raw_text: str):
    """
    Coordina la organización en carpetas y el análisis cognitivo.
    """
    try:
        # 1. ¿De qué día es el entreno? (Inteligencia Flash)
        fecha_dt = detectar_fecha_entrenamiento(raw_text)

        # 2. Guardar el archivo ORIGINAL en su carpeta exacta: 01_LYFTA_RAW
        volcar_archivo_raw(content, extension, fecha_dt)

        # 3. Análisis profundo y actualización de Memoria Lineal
        estado_actual = leer_estado_maestro(FILE_ID_MAESTRO)
        procesar_entrenamiento_llm(raw_text, estado_actual, extension)

    except Exception as e:
        error_msg = f"Fallo en pipeline Lyfta: {str(e)}"
        print(f"[CRÍTICO] {error_msg}")
        volcar_log_sistema(error_msg, f"CRASH_LYFTA_{datetime.datetime.now().strftime('%H%M%S')}.txt")

# =====================================================================
# ENDPOINTS (Webhooks & Crons)
# =====================================================================

@app.post("/webhook/lyfta_workout")
async def recibir_entreno_lyfta(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Acepta el .txt de tu atajo, PDFs, JSONs de Lyfta o CSVs.
    """
    content = await file.read()
    nombre_archivo = file.filename or "entreno.txt"
    extension = nombre_archivo.split('.')[-1].lower() if '.' in nombre_archivo else 'txt'

    # Extraer texto para que la IA sepa qué día es y qué hiciste
    if extension == "pdf":
        raw_text = extraer_texto_pdf(content)
    else:
        raw_text = content.decode('utf-8')

    # Lanzar proceso en segundo plano
    background_tasks.add_task(pipeline_lyfta_background, content, extension, raw_text)

    return {
        "status": "accepted",
        "format": extension,
        "info": "El archivo se clasificará en su carpeta diaria correspondiente."
    }

@app.post("/webhook/google_health_api")
async def recibir_webhook_google_health(request: Request, background_tasks: BackgroundTasks):
    """Receptor oficial para la Fitbit Air."""
    try:
        payload = await request.json()
        background_tasks.add_task(procesar_telemetria_nativa_api, payload)
        return {"status": "accepted"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/cron/diario")
async def daily_sync():
    """Mantenimiento del Gemelo Digital (Peso y Macros)."""
    mutado = sincronizar_biometria_fit()
    return {"mutacion_ejecutada": mutado, "timestamp": datetime.datetime.now().isoformat()}

@app.on_event("startup")
async def startup():
    try:
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        print(f"--- MOTOR V15 ONLINE | USUARIO: {estado['biometria_actual']['peso_kg']}KG ---")
    except:
        print("[ALERTA] No se pudo conectar con el Estado Maestro.")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
