import os
import json
import time
from datetime import datetime
import requests
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from drive_engine import (
    leer_estado_maestro,
    actualizar_estado_maestro,
    descargar_memoria_lineal,
    actualizar_memoria_lineal,
    volcar_log_sistema
)

TOKEN_PATH = "token.json"
FILE_ID_MAESTRO = "1POEuCbmOEIURg7UycPsbIrH62uQvJgLI"
RUTINA_MAESTRA = "Lunes: PULL | Martes: PUSH | Miércoles: LEG | Jueves: PULL | Viernes: PUSH"

def ejecutar_peticion_rest(prompt):
    """Bypass de arquitectura REST HTTP directo a AI Studio."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        volcar_log_sistema("ERROR FATAL: La variable GEMINI_API_KEY no existe en Cloud Run.", f"ERR_API_{datetime.now().strftime('%H%M%S')}.txt")
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1}
    }

    try:
        resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        data = resp.json()

        if resp.status_code != 200:
            volcar_log_sistema(f"HTTP {resp.status_code}: {json.dumps(data)}", f"ERR_HTTP_{datetime.now().strftime('%H%M%S')}.txt")
            return None

        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        volcar_log_sistema(f"Fallo de conexión REST: {str(e)}", f"ERR_NET_{datetime.now().strftime('%H%M%S')}.txt")
        return None

def extraer_metadatos_entreno(texto_crudo):
    prompt = f"""
    Analiza este texto y extrae la fecha y el tipo de rutina.
    RUTINA SEMANAL: {RUTINA_MAESTRA}
    1. Fecha (YYYY-MM-DD o 'TODAY').
    2. Tipo (PUSH, PULL, LEG). Si no se especifica, usa la rutina del día.
    RESPONDE SOLO JSON: {{"fecha": "YYYY-MM-DD", "tipo": "PUSH"}}
    TEXTO: {texto_crudo[:800]}
    """
    resultado_texto = ejecutar_peticion_rest(prompt)

    if resultado_texto:
        try:
            clean_json = resultado_texto.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_json)
            fecha_str = data.get('fecha', 'TODAY')
            fecha_dt = datetime.now() if fecha_str == "TODAY" else datetime.strptime(fecha_str, "%Y-%m-%d")
            return fecha_dt, data.get('tipo', 'ENTRENO').upper()
        except Exception as e:
            volcar_log_sistema(f"Fallo en parseo JSON: {str(e)}", f"ERR_PARSE_{datetime.now().strftime('%H%M%S')}.txt")

    return datetime.now(), "ENTRENO"

def procesar_entrenamiento_llm(raw_text, estado_maestro, formato="txt"):
    historial_mes = descargar_memoria_lineal()
    prompt = f"""
    Analiza biomecánicamente este entreno: {raw_text}.
    Contexto Historial: {historial_mes}
    Estado: {json.dumps(estado_maestro)}
    Extrae ejercicios, volumen y progreso.
    Responde SOLO JSON con llaves 'ejercicios' y 'computo_general'.
    """
    resultado_texto = ejecutar_peticion_rest(prompt)

    if resultado_texto:
        try:
            clean_json = resultado_texto.replace("```json", "").replace("```", "").strip()
            res = json.loads(clean_json)
            log_final = f"\n### [ {datetime.now().isoformat()} ] REPORTE V15.5\n"
            for ex in res.get('ejercicios', []):
                log_final += f"**{ex.get('nombre')}**: {ex.get('volumen_kg')}kg | {ex.get('status')}\n"
            actualizar_memoria_lineal(log_final)
            return res
        except:
            pass
    return {"error": "Fallo en motor de inferencia"}

def procesar_telemetria_nativa_api(payload):
    historial_mes = descargar_memoria_lineal()
    resultado = ejecutar_peticion_rest(f"Telemetría: {json.dumps(payload)}. Contexto: {historial_mes}")
    if resultado:
        actualizar_memoria_lineal(f"[FITBIT] {resultado.strip()}")

def sincronizar_biometria_fit():
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
                        actualizar_memoria_lineal(f"[PESO] Sincronizado: {val}kg.")
                        return True
        return False
    except:
        return False
