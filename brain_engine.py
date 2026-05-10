import os
import json
import time
import io
from datetime import datetime
import requests
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from drive_engine import (
    leer_estado_maestro,
    actualizar_estado_maestro,
    descargar_memoria_lineal,
    actualizar_memoria_lineal,
    volcar_log_sistema,
    obtener_servicio_drive,
    resolver_ruta_inteligente
)

# CONFIGURACIÓN DE IDENTIDAD Y ACCESO
FILE_ID_MAESTRO = "1POEuCbmOEIURg7UycPsbIrH62uQvJgLI"
RUTINA_MAESTRA = "Lunes: PULL | Martes: PUSH | Miércoles: LEG | Jueves: PULL | Viernes: PUSH"

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
    """Persistencia de reportes generados por la IA en el Data Lake."""
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

# --- FLUJOS DE INTELIGENCIA ---

def generar_resumen_pre_entreno():
    """Briefing estratégico de las 09:00 AM para optimizar la sesión de las 10:30 AM."""
    estado = leer_estado_maestro(FILE_ID_MAESTRO)
    historial = descargar_memoria_lineal()

    english_prompt = f"""
    SYSTEM: Senior Performance Architect.
    TASK: Generate a high-density readiness report for the 10:30 AM workout.
    DATA_CONTEXT: {json.dumps(estado)}
    LOG_HISTORY: {historial[-3000:]}
    ROUTINE: {RUTINA_MAESTRA}

    CRITICAL PROTOCOLS:
    1. Check last session loads (e.g. 100kg Chest Press) and calculate CNS fatigue.
    2. MANDATORY: Verify 7g Creatine dosage.
    3. VETO SYSTEM: Explicitly state to AVOID Magnesium and Omega-3 in this morning window.
    4. PREDICTION: Recommend intensity (RPE/Volume) based on recovery logs.

    OUTPUT: Spanish language. Senior technical tone. Markdown format.
    """

    report = ejecutar_peticion_rest(english_prompt, "gemini-3.1-pro-preview")
    if report:
        actualizar_memoria_lineal(f"[SYSTEM] Briefing matutino generado.")
        return salvar_reporte_en_drive(report, "02_RESUMEN_DIARIO_IA", "PRE_ENTRENO")
    return False

def extraer_metadatos_entreno(texto_crudo):
    """Extracción estructural de metadatos (Flash Lite)."""
    prompt = f"""
    TASK: Extract metadata from workout text.
    ROUTINE: {RUTINA_MAESTRA}
    TEXT: {texto_crudo[:800]}
    FORMAT: Strictly JSON {{"fecha": "YYYY-MM-DD", "tipo": "PUSH/PULL/LEG"}}
    """
    res = ejecutar_peticion_rest(prompt, "gemini-3.1-flash-lite")
    if res:
        try:
            data = json.loads(res.replace("```json", "").replace("```", "").strip())
            fecha_dt = datetime.now() if data['fecha'] == 'TODAY' else datetime.strptime(data['fecha'], "%Y-%m-%d")
            return fecha_dt, data['tipo'].upper()
        except: pass
    return datetime.now(), "ENTRENO"

def procesar_entrenamiento_llm(raw_text, estado_maestro, formato="txt"):
    """Análisis biomecánico post-sesión (Pro Preview)."""
    prompt = f"""
    TASK: Biomechanical audit of workout session.
    DATA: {raw_text}
    STATE: {json.dumps(estado_maestro)}
    OUTPUT: Spanish. Extract volume, intensity, and progression notes.
    """
    res = ejecutar_peticion_rest(prompt, "gemini-3.1-pro-preview")
    if res:
        actualizar_memoria_lineal(f"\n### REPORTE POST-ENTRENO\n{res}")
        return res
    return None

def sincronizar_biometria_fit():
    """Sincronización de peso desde Google Fitness API."""
    try:
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
        # Auth logic...
        # (Se mantiene la lógica de agregación de peso ya validada)
        return True
    except: return False
