import os
import json
import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
import uvicorn
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# Importación de tu motor de auto-mutación
from brain_engine import procesar_bitacora_y_mutar

# 1. CARGA DE BIOMETRÍA Y CONSTANTES (HARD CONSTRAINTS)
load_dotenv("/app/.env" if os.path.exists("/app/.env") else ".env")

TOKEN_PATH = "./token.json"
CREDENTIALS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH", "./credenciales_oauth.json")

# Parámetros biométricos dinámicos (Álvaro, 19 años, 160cm)
WEIGHT = float(os.getenv("WEIGHT_KG", 82))
CREATINA = int(os.getenv("CREATINA_DAILY_DOSE_GRAMS", 7))
PROTEINA = int(os.getenv("PROTEIN_DAILY_DOSE_GRAMS", 180))

RESTRICTED_COMPOUNDS = ["Magnesio", "Omega-3"]
SCOPES = [
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/drive.file'
]

app = FastAPI(title="Fitbit Health Node - Álvaro Performance Lab")

# 2. MÓDULOS DE ANÁLISIS BIOQUÍMICO Y ALOSTÁTICO
def audit_security_logs():
    """Bloqueo en el arranque si detecta sustancias vetadas en históricos."""
    for file in os.listdir('.'):
        if file.endswith(".json") and "Recovery_Log" in file:
            with open(file, 'r') as f:
                content = f.read()
                if any(x in content for x in RESTRICTED_COMPOUNDS):
                    print(f"[ALERTA CRÍTICA] Contaminación detectada en {file}. Abortando arranque.")
                    exit(1)

def get_daily_hydration():
    """Calcula el protocolo de hidratación según el desgaste de hipertrofia."""
    day = datetime.datetime.now().strftime("%A")
    protocols = {
        "Monday": "750ml Limonada (Sal + Bicarbonato + Edulcorante)",
        "Wednesday": "750ml Limonada (Sal + Bicarbonato + Edulcorante)",
        "Thursday": "750ml Limonada (Sal + Bicarbonato + Edulcorante)",
        "Tuesday": "750ml Agua de Coco (Potasio natural)",
        "Friday": "750ml Agua de Coco (Potasio natural)"
    }
    return protocols.get(day, "Hidratación estándar (Agua + Electrolitos base)")

def analyze_recovery(hrv_current, sleep_deep_mins, temp_delta):
    """Dictamina el estado del SNC frente al estrés mecánico."""
    status = "ÓPTIMO"
    alerts = []

    if temp_delta > 0.5:
        status = "INFLAMACIÓN DETECTADA"
        alerts.append("Posible sobrecarga mecánica. Reducir RPE en Lyfta.")

    if sleep_deep_mins < 60:
        status = "RECUPERACIÓN COMPROMETIDA"
        alerts.append("Fase profunda insuficiente para síntesis proteica óptima.")

    return {"status": status, "alerts": alerts}

# 3. PERSISTENCIA EN GOOGLE CLOUD (5TB DRIVE)
def save_to_cloud(data):
    """Sube el log de telemetría a tu ecosistema Pro de 5TB."""
    if not os.path.exists(TOKEN_PATH):
        print("[ERROR] No se puede guardar en Cloud. token.json ausente.")
        return

    creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    drive_service = build('drive', 'v3', credentials=creds)

    filename = f"Recovery_Log_{datetime.date.today()}.json"
    with open(filename, "w") as f:
        json.dump(data, f)

    file_metadata = {'name': filename, 'parents': []}
    media = MediaFileUpload(filename, mimetype='application/json')
    drive_service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    os.remove(filename)

# 4. ENDPOINTS (API RESTFUL)
@app.post("/webhook/full_telemetry")
async def receive_telemetry(request: Request):
    """Ingesta de datos biométricos desde Fitbit Air (Día 26)."""
    payload = await request.json()

    hrv = payload.get("hrv", 50)
    temp_delta = payload.get("temp_delta", 0.0)
    sleep_deep = payload.get("deep_sleep_minutes", 0)

    analysis = analyze_recovery(hrv, sleep_deep, temp_delta)
    hydration = get_daily_hydration()

    report = {
        "timestamp": datetime.datetime.now().isoformat(),
        "biometria": {"peso": WEIGHT, "creatina_g": CREATINA, "proteina_g": PROTEINA},
        "hidratacion_hoy": hydration,
        "analisis_recuperacion": analysis,
        "restricciones": "Magnesio y Omega-3 purgados"
    }

    print(f"[TELEMETRÍA] Estado: {analysis['status']} | Hidratación: {hydration}")
    save_to_cloud(report)
    return report

@app.post("/webhook/voice")
async def voice_input(request: Request):
    """Ingesta de telemetría por voz para auto-mutación del sistema."""
    payload = await request.json()
    transcripcion = payload.get("transcripcion", "")

    if transcripcion:
        procesar_bitacora_y_mutar(transcripcion)
        return {"status": "success", "message": "Procesamiento de voz ejecutado."}
    raise HTTPException(status_code=400, detail="Payload vacío")

@app.post("/cron/creatina")
async def inject_creatine():
    """Ejecución programada (Cloud Scheduler) a las 08:00 AM."""
    now = datetime.datetime.utcnow()
    print(f"[CRON] Registrando {CREATINA}g de Creatina a las {now.isoformat()}Z")
    # El registro en Google Fitness requerirá el ID del DataSource tras el día 26
    return {"status": "success", "compound": "Creatina", "dose": CREATINA}

# 5. ARRANQUE DEL SERVIDOR
@app.on_event("startup")
async def startup():
    audit_security_logs()
    print("==================================================")
    print("[SISTEMA] MOTOR V12 - NODO AUTÓNOMO INICIALIZADO")
    print(f"[PERFIL] {WEIGHT}kg | {CREATINA}g Creatina | {PROTEINA}g Proteína")
    print(f"[PROTOCOLO HOY] {get_daily_hydration()}")
    print("==================================================")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
