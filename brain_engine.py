import os
import json
import time
import io
from datetime import datetime
import requests
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

# Importaciones del motor de persistencia
from drive_engine import (
    leer_estado_maestro,
    actualizar_estado_maestro,
    descargar_memoria_lineal,
    actualizar_memoria_lineal,
    volcar_log_sistema,
    obtener_servicio_drive,
    resolver_ruta_inteligente
)

# CONFIGURACIÓN DE IDENTIDAD Y ACCESO MAESTRO
FILE_ID_MAESTRO = "1POEuCbmOEIURg7UycPsbIrH62uQvJgLI"
RUTINA_MAESTRA = "Lunes: PULL | Martes: PUSH | Miércoles: LEG | Jueves: PULL | Viernes: PUSH"
TOKEN_PATH = "token.json"

def ejecutar_peticion_rest(prompt, modelo="gemini-3.1-flash-lite"):
    """Inferencia REST optimizada para la serie Gemini 3.1."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        volcar_log_sistema("MISSING_API_KEY", f"ERR_API_{datetime.now().strftime('%H%M%S')}.txt")
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2048}
    }

    try:
        resp = requests.post(url, json=payload, timeout=30)
        if resp.status_code != 200:
            volcar_log_sistema(f"HTTP_{resp.status_code}_{resp.text}", "ERR_REST.txt")
            return None
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        volcar_log_sistema(str(e), "ERR_CONNECTION.txt")
        return None

def salvar_reporte_en_drive(contenido, subcarpeta, prefijo):
    """Persistencia de reportes de IA en la jerarquía del Data Lake."""
    try:
        drive_service = obtener_servicio_drive()
        id_destino = resolver_ruta_inteligente(datetime.now(), subcarpeta)
        nombre_archivo = f"{prefijo}_{datetime.now().strftime('%d_%m_%Y')}.md"

        media = MediaIoBaseUpload(io.BytesIO(contenido.encode('utf-8')), mimetype='text/markdown')
        drive_service.files().create(body={'name': nombre_archivo, 'parents': [id_destino]}, media_body=media).execute()
        return True
    except Exception as e:
        volcar_log_sistema(f"DRIVE_SAVE_ERR: {str(e)}", "ERR_DRIVE.txt")
        return False

# --- FLUJOS DE INTELIGENCIA ESTRATÉGICA ---

def generar_resumen_pre_entreno():
    """Genera el análisis de preparación de las 09:00 AM."""
    estado = leer_estado_maestro(FILE_ID_MAESTRO)
    historial = descargar_memoria_lineal()

    english_prompt = f"""
    SYSTEM: Senior Performance Architect.
    TASK: Generate a high-density readiness report for the 10:30 AM workout.
    DATA_CONTEXT: {json.dumps(estado)}
    LOG_HISTORY: {historial[-3000:]}
    ROUTINE: {RUTINA_MAESTRA}

    CRITICAL PROTOCOLS:
    1. Cross-reference Sleep/HRV telemetry with previous loads (e.g. 100kg Chest Press).
    2. MANDATORY: Verify 7g Creatine dosage and emphasize its intake.
    3. VETO SYSTEM: Explicitly warn to AVOID Magnesium and Omega-3 in this morning window.
    4. PREDICTION: Set intensity and target volume based on recovery status.

    OUTPUT: Spanish language. Senior technical tone. Markdown format.
    """

    report = ejecutar_peticion_rest(english_prompt, "gemini-3.1-pro-preview")
    if report:
        actualizar_memoria_lineal(f"[SYSTEM] Briefing matutino generado con éxito.")
        return salvar_reporte_en_drive(report, "02_RESUMEN_DIARIO_IA", "PRE_ENTRENO")
    return False

def extraer_metadatos_entreno(texto_crudo):
    """Extracción de fecha y tipo de rutina mediante Flash Lite."""
    english_prompt = f"""
    TASK: Extract metadata from workout text.
    ROUTINE_MAP: {RUTINA_MAESTRA}
    TEXT: {texto_crudo[:800]}
    FORMAT: Strictly JSON {{"fecha": "YYYY-MM-DD", "tipo": "PUSH/PULL/LEG"}}
    """
    res = ejecutar_peticion_rest(english_prompt, "gemini-3.1-flash-lite")
    if res:
        try:
            data = json.loads(res.replace("```json", "").replace("```", "").strip())
            fecha_str = data.get('fecha', 'TODAY')
            fecha_dt = datetime.now() if fecha_str == "TODAY" else datetime.strptime(fecha_str, "%Y-%m-%d")
            return fecha_dt, data.get('tipo', 'ENTRENO').upper()
        except: pass
    return datetime.now(), "ENTRENO"

def procesar_entrenamiento_llm(raw_text, estado_maestro, formato="txt"):
    """Auditoría biomecánica de la sesión realizada."""
    english_prompt = f"""
    PERFORMANCE AUDIT: Analyze this workout session.
    RAW DATA: {raw_text}
    USER CONTEXT: {json.dumps(estado_maestro)}

    OBJECTIVES:
    - Extract exercises, sets, reps, and load.
    - Compare with previous sessions.
    - Identify PRs or strength plateaus.

    OUTPUT: Spanish. Professional biomechanical summary.
    """
    res = ejecutar_peticion_rest(english_prompt, "gemini-3.1-pro-preview")
    if res:
        actualizar_memoria_lineal(f"\n### REPORTE POST-ENTRENO\n{res}")
        return res
    return None

def procesar_telemetria_nativa_api(payload):
    """Procesamiento de datos biométricos en tiempo real."""
    historial_mes = descargar_memoria_lineal()
    english_prompt = f"Analyze this telemetry payload: {json.dumps(payload)}. Context: {historial_mes}. Spanish summary."
    resultado = ejecutar_peticion_rest(english_prompt, "gemini-3.1-flash-lite")
    if resultado:
        actualizar_memoria_lineal(f"[TELEMETRÍA] {resultado.strip()}")

def sincronizar_biometria_fit():
    """Sincronización del peso corporal desde Google Fitness API."""
    try:
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
        creds = Credentials.from_authorized_user_info(json.loads(token_env)) if token_env else Credentials.from_authorized_user_file(TOKEN_PATH)
        service = build('fitness', 'v1', credentials=creds)

        ahora = int(time.time() * 1000)
        res = service.users().dataset().aggregate(userId='me', body={
            "aggregateBy": [{"dataTypeName": "com.google.weight"}],
            "bucketByTime": {"durationMillis": 86400000},
            "startTimeMillis": ahora - 86400000,
            "endTimeMillis": ahora
        }).execute()

        for bucket in res.get('bucket', []):
            for dataset in bucket.get('dataset', []):
                for point in dataset.get('point', []):
                    val = point.get('value', [])[0].get('fpVal')
                    if val and round(val, 1) != round(estado["biometria_actual"]["peso_kg"], 1):
                        estado["biometria_actual"]["peso_kg"] = round(val, 1)
                        actualizar_estado_maestro(FILE_ID_MAESTRO, estado)
                        actualizar_memoria_lineal(f"[BIOMETRÍA] Peso sincronizado: {round(val, 1)}kg.")
                        return True
        return False
    except Exception as e:
        volcar_log_sistema(f"FIT_SYNC_ERR: {str(e)}", "ERR_FIT.txt")
        return False
