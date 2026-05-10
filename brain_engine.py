import os
import json
import time
from datetime import datetime

import google.generativeai as genai
# Bypass arquitectónico para Pylance/Pyright
from google.generativeai import GenerativeModel # type: ignore

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from drive_engine import (
    leer_estado_maestro,
    actualizar_estado_maestro,
    descargar_memoria_lineal,
    actualizar_memoria_lineal,
    volcar_log_sistema
)

# CONFIGURACIÓN DE SEGURIDAD
api_key = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=api_key) # type: ignore

TOKEN_PATH = "token.json"
FILE_ID_MAESTRO = "1POEuCbmOEIURg7UycPsbIrH62uQvJgLI"

RUTINA_MAESTRA = """
Lunes: PULL | Martes: PUSH | Miércoles: LEG | Jueves: PULL | Viernes: PUSH
"""

def extraer_metadatos_entreno(texto_crudo):
    """Identifica Fecha y Tipo de Rutina con Telemetría Activa."""
    # Corrección de Endpoint: Uso de alias explícito
    modelo = GenerativeModel('gemini-1.5-flash-latest')

    prompt = f"""
    Analiza este texto y extrae la fecha y el tipo de rutina.
    RUTINA SEMANAL: {RUTINA_MAESTRA}

    1. Fecha (YYYY-MM-DD o 'TODAY').
    2. Tipo (PUSH, PULL, LEG). Si no se especifica, usa la rutina del día de la semana.

    RESPONDE ÚNICA Y EXCLUSIVAMENTE CON EL FORMATO JSON. NADA DE TEXTO EXTRA.
    {{"fecha": "YYYY-MM-DD", "tipo": "PUSH"}}
    TEXTO: {texto_crudo[:800]}
    """
    try:
        res = modelo.generate_content(prompt)
        clean_json = res.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_json)

        fecha_str = data.get('fecha', 'TODAY')
        fecha_dt = datetime.now() if fecha_str == "TODAY" else datetime.strptime(fecha_str, "%Y-%m-%d")
        return fecha_dt, data.get('tipo', 'ENTRENO').upper()

    except Exception as e:
        mensaje_error = f"ERROR CRÍTICO EN IA METADATOS:\nExcepción: {str(e)}\n"
        volcar_log_sistema(mensaje_error, f"DEBUG_IA_METADATOS_{datetime.now().strftime('%H%M%S')}.txt")
        return datetime.now(), "ENTRENO"

def procesar_entrenamiento_llm(raw_text, estado_maestro, formato="txt"):
    """Analiza la sesión y actualiza el historial."""
    # Corrección de Endpoint: Uso de alias explícito
    modelo = GenerativeModel('gemini-1.5-flash-latest')
    historial_mes = descargar_memoria_lineal()

    prompt = f"""
    Analiza biomecánicamente este entreno: {raw_text}.
    Contexto Historial: {historial_mes}
    Estado Biológico: {json.dumps(estado_maestro)}

    Extrae ejercicios, volumen y progreso.
    Responde SOLO JSON con llaves 'ejercicios' y 'computo_general'.
    """
    try:
        respuesta = modelo.generate_content(prompt)
        clean_json = respuesta.text.replace("```json", "").replace("```", "").strip()
        res = json.loads(clean_json)

        log_final = f"\n### [ {datetime.now().isoformat()} ] REPORTE V15.5\n"
        for ex in res.get('ejercicios', []):
            log_final += f"**{ex.get('nombre')}**: {ex.get('volumen_kg')}kg | {ex.get('status')}\n"

        actualizar_memoria_lineal(log_final)
        return res
    except Exception as e:
        volcar_log_sistema(f"ERROR IA ANÁLISIS: {str(e)}", f"DEBUG_IA_ANALISIS_{datetime.now().strftime('%H%M%S')}.txt")
        return {"error": str(e)}

def procesar_telemetria_nativa_api(payload):
    """Procesamiento de datos de Fitbit."""
    historial_mes = descargar_memoria_lineal()
    # Corrección de Endpoint: Uso de alias explícito
    modelo = GenerativeModel('gemini-1.5-flash-latest')
    try:
        res = modelo.generate_content(f"Telemetría: {json.dumps(payload)}. Contexto: {historial_mes}")
        actualizar_memoria_lineal(f"[FITBIT] {res.text.strip()}")
    except:
        pass

def sincronizar_biometria_fit():
    """Sincroniza peso desde Google Health Connect."""
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
    except Exception as e:
        print(f"[ERROR FIT SYNC] {e}")
        return False
