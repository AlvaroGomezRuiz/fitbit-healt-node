import os
import datetime
import json
from fastapi import FastAPI, Request
import uvicorn

# Importaciones de tus motores V15
from brain_engine import sincronizar_biometria_fit, FILE_ID_MAESTRO
from drive_engine import leer_estado_maestro, volcar_json_diario

app = FastAPI(title="Fitbit Health Node - V15 Ecosistema Autónomo")

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

@app.post("/webhook/full_telemetry")
async def receive_telemetry(request: Request):
    """
    INGESTA V15: Recibe datos de la Fitbit Air e inyecta el diagnóstico en tu Drive de 5TB.
    Este archivo es el que yo (Gemini) leeré para actuar como tu entrenador de élite.
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

        # Enrutamiento al Data Lake (Carpeta del día exacto)
        nombre_reporte = f"DIAGNOSTICO_V15_{datetime.date.today()}.json"
        file_id = volcar_json_diario(report, nombre_reporte)

        print(f"[NUBE V15] Reporte diario inyectado con éxito. ID en Drive: {file_id}")
        return {"status": "success", "report_id": file_id, "analysis": analysis["status"]}

    except Exception as e:
        print(f"[ERROR CRÍTICO V15] Fallo en la inyección de telemetría: {e}")
        return {"status": "error", "message": str(e)}

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
    """Autodiagnóstico del contenedor al arrancar en Google Cloud."""
    try:
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        print("==================================================")
        print("[SISTEMA] MOTOR V15 - ECOSISTEMA AUTÓNOMO ONLINE")
        print(f"[PERFIL] {estado['identidad']['genero']} | {estado['biometria_actual']['peso_kg']}kg")
        print(f"[MACROS] {estado['restricciones_duras']['proteina_g']}g Proteína | {estado['restricciones_duras']['calorias_objetivo']}kcal")
        print("==================================================")
    except Exception as e:
        print(f"[ALERTA CRÍTICA] Fallo de enlace con el Cerebro en Drive. Verifica FILE_ID_MAESTRO: {e}")

if __name__ == "__main__":
    # Configuración de puerto dinámica para Cloud Run
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
