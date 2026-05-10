import os
import json
import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
import uvicorn
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# Importación del nuevo motor de extracción multidimensional (Pull)
from brain_engine import sincronizar_biometria_fit

# 1. CARGA DE BIOMETRÍA Y CONSTANTES (HARD CONSTRAINTS)
ENV_PATH = "/app/.env" if os.path.exists("/app/.env") else ".env"
load_dotenv(ENV_PATH)

TOKEN_PATH = "./token.json"
CREDENTIALS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH", "./credenciales_oauth.json")

# Parámetros biométricos base en memoria
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

@app.post("/cron/creatina")
async def inject_creatine():
    """Ejecución programada (Cloud Scheduler) a las 08:00 AM."""
    now = datetime.datetime.utcnow()
    print(f"[CRON] Registrando {CREATINA}g de Creatina a las {now.isoformat()}Z")

    # Extracción multidimensional y auto-mutación silenciosa
    sincronizar_biometria_fit()

    return {"status": "success", "compound": "Creatina", "dose": CREATINA, "sync": "Biometría evaluada"}

# 5. ARRANQUE DEL SERVIDOR
@app.on_event("startup")
async def startup():
    audit_security_logs()

    # Recarga dinámica para lectura de logs de inicio precisos
    load_dotenv(ENV_PATH, override=True)
    peso_inicio = os.getenv("WEIGHT_KG", 82)
    altura_inicio = os.getenv("HEIGHT_CM", 160)
    edad_inicio = os.getenv("YEARS", 19)
    creatina_inicio = os.getenv("CREATINA_DAILY_DOSE_GRAMS", 7)
    proteina_inicio = os.getenv("PROTEIN_DAILY_DOSE_GRAMS", 180)

    print("==================================================")
    print("[SISTEMA] MOTOR V14 - COACH DE ÉLITE INICIALIZADO")
    print(f"[PERFIL] {edad_inicio} años | {altura_inicio}cm | {peso_inicio}kg")
    print(f"[MACROS] {creatina_inicio}g Creatina | {proteina_inicio}g Proteína")
    print(f"[PROTOCOLO HOY] {get_daily_hydration()}")
    print("==================================================")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
