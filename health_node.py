import os
import datetime
import json
from fastapi import FastAPI, Request, BackgroundTasks, UploadFile, File
import uvicorn

# Importaciones de tus motores V15 (Asegúrate de haber guardado los cambios previos en estos archivos)
from brain_engine import sincronizar_biometria_fit, FILE_ID_MAESTRO, procesar_entrenamiento_llm
from drive_engine import leer_estado_maestro, volcar_json_ia, volcar_entreno_lyfta, volcar_log_sistema

app = FastAPI(title="Fitbit Health Node - Google Health Premium Coach (V15)")

def get_daily_hydration():
    """Protocolo de nutrición de élite basado en el día de la semana."""
    day = datetime.datetime.now().strftime("%A")
    protocols = {
        "Monday": "750ml Limonada (Sal + Bicarbonato)",
        "Wednesday": "750ml Limonada (Sal + Bicarbonato)",
        "Thursday": "750ml Limonada (Sal + Bicarbonato)",
        "Tuesday": "750ml Agua de Coco (Potasio natural)",
        "Friday": "750ml Agua de Coco (Potasio natural)"
    }
    return protocols.get(day, "Hidratación estándar (Agua + Electrolitos base)")

def analyze_recovery(hrv_current, sleep_deep_mins, temp_delta):
    """Motor Alostático Proactivo."""
    status = "ÓPTIMO"
    alerts = []
    if temp_delta > 0.5:
        status = "INFLAMACIÓN DETECTADA"
        alerts.append("Posible sobrecarga mecánica. Reducir RPE en Lyfta.")
    if sleep_deep_mins < 60:
        status = "RECUPERACIÓN COMPROMETIDA"
        alerts.append("Fase profunda insuficiente para síntesis proteica óptima.")
    return {"status": status, "alerts": alerts}

def pipeline_cognitivo_segundo_plano(csv_text: str):
    """
    Worker asíncrono para ingesta, inferencia y persistencia de hipertrofia.
    Ejecuta el protocolo de IA sin bloquear la respuesta de la app de origen.
    """
    try:
        # 1. Ingesta del Raw Data en la ruta estricta
        volcar_entreno_lyfta(csv_text)
        print("[SISTEMA] CSV de Lyfta persistido en conducto 01_LYFTA_RAW.")

        # 2. Sincronización de Biometría (Google Fit)
        print("[SISTEMA] Sincronizando biometría periférica...")
        sincronizar_biometria_fit()

        # 3. Carga del Contexto Biológico Actualizado
        estado_actual = leer_estado_maestro(FILE_ID_MAESTRO)

        # 4. Inferencia Cognitiva (RAG / Gemini)
        print("[IA] Ejecutando modelo de correlación biomecánica y alostasis...")
        diagnostico_ia = procesar_entrenamiento_llm(csv_text, estado_actual)

        # 5. Persistencia del Dictamen
        timestamp = datetime.datetime.now().strftime('%H%M')
        nombre_reporte = f"DIAGNOSTICO_COACH_ENTRENO_{timestamp}.json"
        volcar_json_ia(diagnostico_ia, nombre_reporte)
        print(f"[IA] Dictamen de recuperación persistido en 02_RESUMEN_DIARIO_IA: {nombre_reporte}")

    except Exception as e:
        error_msg = f"Fallo crítico en pipeline de análisis asíncrono: {str(e)}"
        print(f"[ERROR] {error_msg}")
        try:
            timestamp_error = datetime.datetime.now().strftime('%H%M')
            volcar_log_sistema(error_msg, f"CRASH_LOG_{timestamp_error}.txt")
        except Exception as log_error:
            print(f"[ERROR FATAL] Imposible escribir en conducto de logs: {log_error}")

@app.post("/webhook/lyfta_workout")
async def recibir_entreno_lyfta(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Edge Endpoint de Ingesta (Entrenamientos).
    Recepción en tiempo real con latencia mínima. Retorna 200 OK inmediatamente.
    """
    content = await file.read()
    csv_text = content.decode('utf-8')

    background_tasks.add_task(pipeline_cognitivo_segundo_plano, csv_text)

    return {
        "status": "accepted",
        "message": "Telemetría recibida. El ecosistema Google Health está procesando la correlación en segundo plano."
    }

@app.post("/webhook/full_telemetry")
async def receive_telemetry(request: Request):
    """
    INGESTA V15: Recibe datos de la Fitbit Air (sueño, VFC, temp).
    """
    try:
        payload = await request.json()

        # Extracción de sensores
        hrv = payload.get("hrv", 50)
        temp_delta = payload.get("temp_delta", 0.0)
        sleep_deep = payload.get("deep_sleep_minutes", 0)

        # Evaluación biométrica
        analysis = analyze_recovery(hrv, sleep_deep, temp_delta)
        hydration = get_daily_hydration()

        # Lectura del cerebro (estado maestro)
        estado_actual = leer_estado_maestro(FILE_ID_MAESTRO)

        # Construcción del payload final
        report = {
            "timestamp": datetime.datetime.now().isoformat(),
            "biometria_operativa": estado_actual["biometria_actual"],
            "hidratacion_hoy": hydration,
            "analisis_recuperacion": analysis,
            "restricciones_duras": estado_actual["restricciones_duras"],
            "mensajes_sistema": [
                f"Peso detectado: {estado_actual['biometria_actual']['peso_kg']}kg",
                f"Objetivo calórico: {estado_actual['restricciones_duras']['calorias_objetivo']}kcal"
            ]
        }

        # Enrutamiento al Data Lake (Inyecta directamente en 02_RESUMEN_DIARIO_IA)
        nombre_reporte = f"DIAGNOSTICO_BIOMETRIA_{datetime.datetime.now().strftime('%H%M')}.json"
        file_id = volcar_json_ia(report, nombre_reporte)

        print(f"[NUBE V15] Reporte biométrico inyectado con éxito. ID en Drive: {file_id}")
        return {"status": "success", "report_id": file_id, "analysis": analysis["status"]}

    except Exception as e:
        error_msg = f"Fallo en la inyección de telemetría biométrica: {str(e)}"
        print(f"[ERROR CRÍTICO V15] {error_msg}")
        return {"status": "error", "message": error_msg}

@app.post("/cron/diario")
async def daily_sync():
    """Sincroniza peso con Google Health y actualiza tu Gemelo Digital en Drive."""
    print("[CRON] Iniciando recálculo biométrico diario...")
    mutado = sincronizar_biometria_fit()
    return {"mutacion_ejecutada": mutado, "timestamp": datetime.datetime.now().isoformat()}

@app.post("/cron/creatina")
async def inject_creatine():
    """Automatiza el registro de la dosis ergogénica diaria."""
    now = datetime.datetime.utcnow()
    estado = leer_estado_maestro(FILE_ID_MAESTRO)
    dosis = estado["restricciones_duras"]["creatina_g"]
    print(f"[CRON] Registrando {dosis}g de Creatina en el sistema central a las {now.isoformat()}Z")
    return {"status": "success", "compound": "Creatina", "dose": dosis}

@app.on_event("startup")
async def startup():
    """Autodiagnóstico del contenedor al arrancar en Google Cloud Run."""
    try:
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        print("==================================================")
        print("[SISTEMA] MOTOR V15 - GOOGLE HEALTH COACH ONLINE")
        print(f"[PERFIL] {estado['identidad']['genero']} | {estado['biometria_actual']['peso_kg']}kg")
        print(f"[MACROS] {estado['restricciones_duras']['proteina_g']}g Proteína | {estado['restricciones_duras']['calorias_objetivo']}kcal")
        print("==================================================")
    except Exception as e:
        print(f"[ALERTA CRÍTICA] Fallo de enlace con el Cerebro en Drive. Verifica FILE_ID_MAESTRO: {e}")

if __name__ == "__main__":
    # Configuración de puerto dinámica para Cloud Run
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
