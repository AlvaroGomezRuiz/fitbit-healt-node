import os
import json
import time
from datetime import datetime
import google.generativeai as genai # pyright: ignore[reportMissingImports]
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from drive_engine import (
    leer_estado_maestro,
    actualizar_estado_maestro,
    descargar_memoria_lineal,
    actualizar_memoria_lineal
)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY")) # pyright: ignore[reportPrivateImportUsage]

TOKEN_PATH = "token.json"
FILE_ID_MAESTRO = "1POEuCbmOEIURg7UycPsbIrH62uQvJgLI"

RUTINA_MAESTRA = """
Lunes: PULL | Martes: PUSH | Miércoles: LEG | Jueves: PULL | Viernes: PUSH
"""

def extraer_metadatos_entreno(texto_crudo):
    # pyright: ignore[reportPrivateImportUsage]
    modelo_flash = genai.GenerativeModel('gemini-1.5-flash') #type: ignore
    prompt = f"Analiza la fecha (YYYY-MM-DD o 'TODAY') y el tipo (PUSH, PULL, LEG) según esta rutina: {RUTINA_MAESTRA}. Responde solo JSON: {{\"fecha\": \"...\", \"tipo\": \"...\"}}. Texto: {texto_crudo[:800]}"
    try:
        res = modelo_flash.generate_content(prompt)
        data = json.loads(res.text.replace("```json", "").replace("```", "").strip())
        fecha_dt = datetime.now() if data['fecha'] == "TODAY" else datetime.strptime(data['fecha'], "%Y-%m-%d")
        return fecha_dt, data['tipo'].upper()
    except:
        return datetime.now(), "ENTRENO"

def procesar_entrenamiento_llm(raw_text, estado_maestro, formato="txt"):
    # pyright: ignore[reportPrivateImportUsage]
    modelo_pro = genai.GenerativeModel('gemini-1.5-pro') #type: ignore
    historial_mes = descargar_memoria_lineal()
    prompt = f"Analiza biomecánicamente este entreno: {raw_text}. Historial: {historial_mes}. Estado: {json.dumps(estado_maestro)}. Responde JSON con 'ejercicios' y 'computo_general'."
    respuesta = modelo_pro.generate_content(prompt)
    res = json.loads(respuesta.text.replace("```json", "").replace("```", "").strip())

    log_final = f"\n### [ {datetime.now().isoformat()} ] REPORTE\n"
    for ex in res['ejercicios']:
        log_final += f"**{ex['nombre']}**: {ex['volumen_kg']}kg | {ex['status']}\n"
    actualizar_memoria_lineal(log_final)
    return res

def procesar_telemetria_nativa_api(payload):
    historial_mes = descargar_memoria_lineal()
    # pyright: ignore[reportPrivateImportUsage]
    modelo = genai.GenerativeModel('gemini-1.5-pro') #type: ignore
    res = modelo.generate_content(f"Telemetría: {json.dumps(payload)}. Contexto: {historial_mes}")
    actualizar_memoria_lineal(f"[FITBIT] {res.text.strip()}")

def sincronizar_biometria_fit():
    try:
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
        creds = Credentials.from_authorized_user_info(json.loads(token_env)) if token_env else Credentials.from_authorized_user_file(TOKEN_PATH)
        service = build('fitness', 'v1', credentials=creds)
        ahora = int(time.time() * 1000)
        res = service.users().dataset().aggregate(userId='me', body={"aggregateBy": [{"dataTypeName": "com.google.weight"}], "bucketByTime": {"durationMillis": 86400000}, "startTimeMillis": ahora - 86400000, "endTimeMillis": ahora}).execute()
        for bucket in res.get('bucket', []):
            for dataset in bucket.get('dataset', []):
                for point in dataset.get('point', []):
                    val = point.get('value', [])[0].get('fpVal')
                    if val:
                        estado["biometria_actual"]["peso_kg"] = round(val, 1)
                        actualizar_estado_maestro(FILE_ID_MAESTRO, estado)
                        return True
        return False
    except: return False
