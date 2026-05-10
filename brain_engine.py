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

# Configuración del Motor Cognitivo
genai.configure(api_key=os.environ.get("GEMINI_API_KEY")) # pyright: ignore[reportPrivateImportUsage]

TOKEN_PATH = "token.json"
FILE_ID_MAESTRO = "1POEuCbmOEIURg7UycPsbIrH62uQvJgLI"

def recalcular_bmr(peso, altura, edad):
    """Ecuación de Mifflin-St Jeor."""
    return (10 * peso) + (6.25 * altura) - (5 * edad) + 5

def procesar_telemetria_nativa_api(payload):
    """
    MOTOR V15: Analiza Webhooks entrantes de la Fitbit Air (Google Health API).
    """
    historial_mes = descargar_memoria_lineal()
    estado_maestro = leer_estado_maestro(FILE_ID_MAESTRO)

    modelo = genai.GenerativeModel('gemini-1.5-pro') # pyright: ignore[reportPrivateImportUsage]

    prompt_sistema = f"""
    System Context: You are the Google Health Premium Coach (V15 Core Engine).
    Current Biological State: {json.dumps(estado_maestro['biometria_actual'])}
    Linear Memory Log: {historial_mes}
    New Telemetry (Fitbit Air): {json.dumps(payload)}

    Execution Requirements:
    Cross-reference the new telemetry with physical fatigue in Linear Memory.
    Output a precise clinical assessment in Spanish and an actionable directive.
    Keep it to exactly one dense paragraph.
    """

    print("[IA] Analizando telemetría de Fitbit contra Memoria Lineal...")
    respuesta = modelo.generate_content(prompt_sistema)
    diagnostico = respuesta.text.strip()

    tipo_dato = payload.get("dataTypeName", "telemetry_event")
    actualizar_memoria_lineal(f"[FITBIT AIR - {tipo_dato.upper()}] Coach IA: {diagnostico}")

    return diagnostico

def procesar_entrenamiento_llm(raw_text, estado_maestro, formato="txt"):
    """
    ANALISTA BIOMECÁNICO V15: Disección por ejercicio y cómputo general.
    Optimizado para interpretar texto crudo, PDFs extraídos o CSVs.
    """
    modelo = genai.GenerativeModel('gemini-1.5-pro') # type: ignore
    historial_mes = descargar_memoria_lineal()

    # Prompt ultra-específico para el manejo de TEXTO
    prompt_sistema = f"""
    System Context: You are a Senior Performance Analyst for Google Health Premium.
    Input Format Detected: {formato.upper()}

    HISTORICAL CONTEXT (Linear Memory):
    {historial_mes}

    USER MASTER STATE:
    {json.dumps(estado_maestro['biometria_actual'])}

    RAW TRAINING DATA:
    {raw_text}

    TASK:
    1. Parse the {formato} data. If it's unstructured text, find exercises, sets, reps, and weight.
    2. Compare each exercise with the Historical Context to detect PRs (Personal Records) or improvements.
    3. Calculate tonnage per exercise and total.
    4. Detect Set Type (Top Set, Back-off, etc.) from the text descriptions.
    5. Provide a technical analysis and recovery directive for every specific exercise.

    OUTPUT FORMAT (Valid JSON ONLY):
    {{
        "ejercicios": [
            {{
                "nombre": "<string>",
                "volumen_kg": <int>,
                "status": "PR / MEJORA / ESTANCAMIENTO",
                "analisis": "<string en español>",
                "directiva": "<string en español>"
            }}
        ],
        "computo_general": {{
            "tonelaje_total": <int>,
            "diagnostico_global": "<análisis del SNC y fatiga en español>",
            "directiva_maestra": "<acción suplementaria o descanso en español>"
        }}
    }}
    """

    print(f"[IA] Iniciando disección biomecánica (Formato: {formato})...")
    respuesta = modelo.generate_content(prompt_sistema)

    # Extracción blindada del JSON
    json_crudo = respuesta.text.replace("```json", "").replace("```", "").strip()
    try:
        res = json.loads(json_crudo)
    except Exception as e:
        print(f"[ERROR JSON] Fallo al parsear respuesta de IA: {e}")
        return None

    # Construcción del Log en Drive (Formato Hiper-Específico)
    timestamp = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    log_final = f"\n### [ {timestamp} ] REPORTE DE SESIÓN ({formato.upper()})\n"

    for ex in res['ejercicios']:
        log_final += (
            f"--- EJERCICIO: {ex['nombre'].upper()} ---\n"
            f"Volumen: {ex['volumen_kg']}kg | Progresión: {ex['status']}\n"
            f"Análisis: {ex['analisis']}\n"
            f"Directiva: {ex['directiva']}\n\n"
        )

    log_final += (
        f"== CÓMPUTO GENERAL DE LA SESIÓN ==\n"
        f"Tonelaje Total: {res['computo_general']['tonelaje_total']}kg\n"
        f"Diagnóstico SNC: {res['computo_general']['diagnostico_global']}\n"
        f"Directiva Maestra: {res['computo_general']['directiva_maestra']}\n"
        f"-------------------------------------------\n"
    )

    actualizar_memoria_lineal(log_final)
    return res

def sincronizar_biometria_fit():
    """
    Sincronización de peso y macros (Gemelo Digital).
    """
    try:
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        peso_actual = float(estado["biometria_actual"]["peso_kg"])
        altura_actual = float(estado["biometria_actual"]["altura_cm"])
        edad_actual = int(estado["identidad"]["edad"])

        token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
        creds = Credentials.from_authorized_user_info(json.loads(token_env)) if token_env else Credentials.from_authorized_user_file(TOKEN_PATH)

        fitness_service = build('fitness', 'v1', credentials=creds)
        end_time = int(time.time() * 1000)
        start_time = end_time - 86400000

        body = {
            "aggregateBy": [{"dataTypeName": "com.google.weight"}, {"dataTypeName": "com.google.height"}],
            "bucketByTime": {"durationMillis": 86400000},
            "startTimeMillis": start_time,
            "endTimeMillis": end_time
        }

        response = fitness_service.users().dataset().aggregate(userId='me', body=body).execute()

        nuevo_peso, nueva_altura = peso_actual, altura_actual
        mutacion = False

        for bucket in response.get('bucket', []):
            for dataset in bucket.get('dataset', []):
                for point in dataset.get('point', []):
                    val = point.get('value', [])[0].get('fpVal')
                    if not val: continue
                    if 'weight' in dataset.get('dataSourceId', '').lower() and round(val, 1) != round(peso_actual, 1):
                        nuevo_peso = round(val, 1)
                        mutacion = True
                    elif 'height' in dataset.get('dataSourceId', '').lower():
                        nueva_altura = round(val * 100 if val < 3.0 else val, 1)
                        mutacion = True

        if mutacion:
            estado["biometria_actual"]["peso_kg"] = nuevo_peso
            estado["biometria_actual"]["altura_cm"] = nueva_altura
            estado["restricciones_duras"]["calorias_objetivo"] = int(recalcular_bmr(nuevo_peso, nueva_altura, edad_actual) - 400)
            actualizar_estado_maestro(FILE_ID_MAESTRO, estado)
            actualizar_memoria_lineal(f"[ALOSTASIS] Gemelo Digital actualizado. Nuevo Peso: {nuevo_peso}kg.")
            return True
        return False
    except Exception as e:
        print(f"[ERROR FIT] {e}")
        return False
