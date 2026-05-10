import os
import datetime
import io
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Request
import uvicorn

try:
    from pypdf import PdfReader # pyright: ignore[reportMissingImports]
except ImportError:
    PdfReader = None

from brain_engine import (
    procesar_entrenamiento_llm,
    procesar_telemetria_nativa_api,
    sincronizar_biometria_fit,
    extraer_metadatos_entreno,
    FILE_ID_MAESTRO
)
from drive_engine import (
    leer_estado_maestro,
    volcar_archivo_raw,
    volcar_log_sistema,      # Importación verificada
    actualizar_memoria_lineal
)

app = FastAPI(title="Google Health Premium Node", version="15.5")

def extraer_texto_pdf(file_content: bytes) -> str:
    if PdfReader is None: return "Error: pypdf ausente."
    try:
        reader = PdfReader(io.BytesIO(file_content))
        return "\n".join([page.extract_text() or "" for page in reader.pages])
    except: return "Error en PDF"

def pipeline_entrenamiento_completo(content: bytes, extension: str, raw_text: str):
    try:
        fecha_dt, tipo_rutina = extraer_metadatos_entreno(raw_text)
        volcar_archivo_raw(content, extension, fecha_dt, tipo_rutina)
        estado_actual = leer_estado_maestro(FILE_ID_MAESTRO)
        procesar_entrenamiento_llm(raw_text, estado_actual, extension)
    except Exception as e:
        # Usamos volcar_log_sistema de forma segura
        msg_error = f"Error en pipeline: {str(e)}"
        volcar_log_sistema(msg_error, f"ERR_{datetime.datetime.now().strftime('%H%M%S')}.txt")

@app.post("/webhook/lyfta_workout")
async def recibir_entreno_lyfta(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    content = await file.read()

    # SOLUCIÓN AL ERROR DE LINTER: Verificamos si el nombre existe
    filename = file.filename if file.filename else "entreno.txt"
    ext = filename.split('.')[-1].lower() if '.' in filename else 'txt'

    try:
        raw_text = extraer_texto_pdf(content) if ext == "pdf" else content.decode('utf-8')
    except:
        raw_text = "Contenido no decodificable"

    background_tasks.add_task(pipeline_entrenamiento_completo, content, ext, raw_text)
    return {"status": "accepted"}

@app.post("/webhook/google_health_api")
async def recibir_telemetria(request: Request, background_tasks: BackgroundTasks):
    payload = await request.json()
    background_tasks.add_task(procesar_telemetria_nativa_api, payload)
    return {"status": "accepted"}

@app.post("/cron/diario")
async def sincronizacion():
    return {"ejecutado": sincronizar_biometria_fit()}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
