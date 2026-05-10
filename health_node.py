import os
import datetime
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Request
import uvicorn

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

app = FastAPI(title="Google Health Premium Edge Node", version="15.0")

# =====================================================================
# WORKERS ASÍNCRONOS (Evitan timeouts en Cloud Run)
# =====================================================================

def pipeline_lyfta_background(csv_text: str):
    """Procesa entrenamientos de fuerza de forma asíncrona."""
    try:
        # 1. Archivar dato crudo por seguridad (Data Lake)
        volcar_entreno_lyfta(csv_text)

        # 2. Extraer contexto biológico actual
        estado_actual = leer_estado_maestro(FILE_ID_MAESTRO)

        # 3. Inferencia LLM contra la Memoria Lineal
        procesar_entrenamiento_llm(csv_text, estado_actual)

    except Exception as e:
        error_msg = f"Fallo en pipeline mecánico Lyfta: {str(e)}"
        print(f"[CRÍTICO] {error_msg}")
        volcar_log_sistema(error_msg, f"CRASH_LYFTA_{datetime.datetime.now().strftime('%H%M%S')}.txt")

def pipeline_telemetria_background(payload: dict):
    """Procesa eventos nativos de la API de Google Health (Fitbit Air)."""
    try:
        procesar_telemetria_nativa_api(payload)
    except Exception as e:
        error_msg = f"Fallo en pipeline biométrico Health API: {str(e)}"
        print(f"[CRÍTICO] {error_msg}")
        volcar_log_sistema(error_msg, f"CRASH_HEALTH_{datetime.datetime.now().strftime('%H%M%S')}.txt")

# =====================================================================
# ENDPOINTS DE INGESTA (Edge / Webhooks)
# =====================================================================

@app.post("/webhook/google_health_api")
async def recibir_webhook_google_health(request: Request, background_tasks: BackgroundTasks):
    """
    NUEVO CONDUCTO PRINCIPAL V15:
    Receptor oficial de Webhooks Push desde la Fitbit Air.
    """
    try:
        payload = await request.json()

        # Delegación inmediata al bus asíncrono
        background_tasks.add_task(pipeline_telemetria_background, payload)

        return {"status": "accepted", "message": "Telemetría recibida y enrutada a Memoria Lineal"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/webhook/lyfta_workout")
async def recibir_entreno_lyfta(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    CONDUCTO SECUNDARIO:
    Receptor de cargas mecánicas vía CSV de la app Lyfta.
    """
    content = await file.read()
    csv_text = content.decode('utf-8')

    background_tasks.add_task(pipeline_lyfta_background, csv_text)

    return {"status": "accepted", "message": "Entrenamiento derivado a análisis de hipertrofia"}

# =====================================================================
# CRONOGRAMAS Y MANTENIMIENTO AUTÓNOMO
# =====================================================================

@app.post("/cron/diario")
async def daily_sync():
    """Fallback alostático: Asegura la integridad del peso maestro 1 vez al día."""
    print("[CRON] Verificando integridad biométrica...")
    mutado = sincronizar_biometria_fit()
    return {"mutacion_ejecutada": mutado, "timestamp": datetime.datetime.now().isoformat()}

@app.post("/cron/creatina")
async def inject_creatine():
    """Automatización del registro ergogénico."""
    estado = leer_estado_maestro(FILE_ID_MAESTRO)
    dosis = estado["restricciones_duras"]["creatina_g"]

    # Escribe directamente en la memoria lineal para que la IA lo sepa
    log_dosis = f"[SISTEMA] Dosis diaria automática de Creatina registrada: {dosis}g."
    actualizar_memoria_lineal(log_dosis)

    return {"status": "success", "compound": "Creatina", "dose": dosis}

@app.on_event("startup")
async def startup():
    """Autodiagnóstico del contenedor."""
    try:
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        print("==================================================")
        print("[SISTEMA] MOTOR V15 - GOOGLE HEALTH COACH ONLINE")
        print(f"Modo: Memoria Lineal Activa | Ventana RAG: 2M Tokens")
        print(f"[PERFIL] {estado['biometria_actual']['peso_kg']}kg | Objetivo: {estado['restricciones_duras']['calorias_objetivo']}kcal")
        print("==================================================")
    except Exception as e:
        print(f"[ALERTA CRÍTICA] Fallo de enlace en el arranque. Verifica variables de entorno y FILE_ID_MAESTRO: {e}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
