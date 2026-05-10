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

# Configuración de API - Silenciamos el error de exportación para el linter
genai.configure(api_key=os.environ.get("GEMINI_API_KEY")) # pyright: ignore[reportPrivateImportUsage]

TOKEN_PATH = "token.json"
FILE_ID_MAESTRO = "1POEuCbmOEIURg7UycPsbIrH62uQvJgLI"

def recalcular_bmr(peso, altura, edad):
    """Ecuación de Mifflin-St Jeor."""
    return (10 * peso) + (6.25 * altura) - (5 * edad) + 5

def detectar_fecha_entrenamiento(texto_crudo):
    """
    IA Rápida: Determina la cronología del entreno para la organización de carpetas.
    """
    # pyright: ignore[reportPrivateImportUsage]
    modelo_flash = genai.GenerativeModel('gemini-1.5-flash') #type: ignore
    prompt = f"""
    Extract the date of this workout as YYYY-MM-DD.
    If no date is mentioned, return 'TODAY'.
    Text: {texto_crudo[:1000]}
    """
    try:
        res = modelo_flash.generate_content(prompt)
        fecha_str = res.text.strip()
        if "TODAY" in fecha_str:
            return datetime.now()
        return datetime.strptime(fecha_str, "%Y-%m-%d")
    except:
        return datetime.now()

def procesar_entrenamiento_llm(raw_text, estado_maestro, formato="txt"):
    """
    ANALISTA BIOMECÁNICO V15: Disección por ejercicio y cómputo global.
    """
    # pyright: ignore[reportPrivateImportUsage]
    modelo_pro = genai.GenerativeModel('gemini-1.5-pro') #type: ignore
    historial_mes = descargar_memoria_lineal()

    prompt_sistema = f"""
    System Context: Senior Performance Analyst for Google Health Premium.
    Input Format: {formato.upper()}

    HISTORICAL CONTEXT (Linear Memory):
    {historial_mes}

    USER MASTER STATE:
    {json.dumps(estado_maestro['biometria_actual'])}

    RAW TRAINING DATA:
    {raw_text}

    TASK:
    1. Parse the data. Identify every exercise, set, rep, and weight.
    2. Compare with 'Historical Context' to detect PRs, improvements, or stagnation.
    3. Calculate tonnage per exercise and total.
    4. Provide a technical analysis and recovery directive for every specific exercise in Spanish.

    Output Format (JSON ONLY):
    {{
        "ejercicios": [
            {{
                "nombre": "string",
                "volumen_kg": int,
                "status": "PR / MEJORA / ESTANCAMIENTO",
                "analisis": "string en español",
                "directiva": "string en español"
            }}
        ],
        "computo_general": {{
            "tonelaje_total": int,
            "diagnostico_global": "análisis del SNC y fatiga en español",
            "directiva_maestra": "acción suplementaria o descanso en español"
        }}
    }}
    """

    print(f"[IA] Ejecutando análisis profundo (Formato: {formato})...")
    respuesta = modelo_pro.generate_content(prompt_sistema)

    # Limpieza de JSON
    json_crudo = respuesta.text.replace("```json", "").replace("```", "").strip()
    res = json.loads(json_crudo)

    # Construcción del Reporte Markdown
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

def procesar_telemetria_nativa_api(payload):
    """Analiza datos de Fitbit Air contra la fatiga registrada en Drive."""
    historial_mes = descargar_memoria_lineal()
    estado_maestro = leer_estado_maestro(FILE_ID_MAESTRO)
    # pyright: ignore[reportPrivateImportUsage]
    modelo = genai.GenerativeModel('gemini-1.5-pro') #type: ignore

    prompt = f"""
    Analyze this Fitbit telemetry: {json.dumps(payload)}
    Context: {historial_mes}
    State: {json.dumps(estado_maestro['biometria_actual'])}
    Provide a clinical assessment in Spanish (1 paragraph).
    """
    res = modelo.generate_content(prompt)
    diagnostico = res.text.strip()

    tipo = payload.get("dataTypeName", "telemetria")
    actualizar_memoria_lineal(f"[FITBIT - {tipo.upper()}] Coach: {diagnostico}")
    return diagnostico

def sincronizar_biometria_fit():
    """Sincronización diaria del peso y ajuste de macros."""
    try:
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
        creds = Credentials.from_authorized_user_info(json.loads(token_env)) if token_env else Credentials.from_authorized_user_file(TOKEN_PATH)

        service = build('fitness', 'v1', credentials=creds)
        ahora = int(time.time() * 1000)

        # Petición de peso
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
                        nuevo_bmr = recalcular_bmr(val, estado["biometria_actual"]["altura_cm"], estado["identidad"]["edad"])
                        estado["restricciones_duras"]["calorias_objetivo"] = int(nuevo_bmr - 400)
                        actualizar_estado_maestro(FILE_ID_MAESTRO, estado)
                        actualizar_memoria_lineal(f"[ALOSTASIS] Peso actualizado: {val}kg. Macros reajustados.")
                        return True
        return False
    except Exception as e:
        print(f"Error en sincronización: {e}")
        return False
