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

    Current Biological State:
    {json.dumps(estado_maestro['biometria_actual'])}

    Linear Memory Log:
    {historial_mes}

    New Telemetry (Fitbit Air):
    {json.dumps(payload)}

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

def procesar_entrenamiento_llm(csv_text, estado_maestro):
    """
    ANALISTA BIOMECÁNICO V15: Disección por ejercicio y cómputo global.
    Este motor procesa cada serie para compararla con el historial y emitir directivas.
    """
    modelo = genai.GenerativeModel('gemini-1.5-pro') # pyright: ignore[reportPrivateImportUsage]
    historial_mes = descargar_memoria_lineal()

    prompt_sistema = f"""
    System Context: You are a Senior Performance Analyst for Google Health Premium.

    Historical Context (Linear Memory):
    {historial_mes}

    New Training Data (Lyfta CSV):
    {csv_text}

    Task:
    1. Parse EVERY exercise in the CSV.
    2. For each exercise: Compare weight/reps/tonnage with the historical log provided.
    3. Determine if there was a PR (Personal Record), improvement, or stagnation for that specific movement.
    4. Provide a technical analysis and a recovery directive for that specific muscle group.
    5. After analyzing all exercises, provide a "Computo General" of the session.

    LANGUAGE: Output all text values in Technical Spanish.

    Output Format (Valid JSON ONLY):
    {{
        "ejercicios": [
            {{
                "nombre": "<nombre del ejercicio>",
                "volumen_kg": <int>,
                "status": "MEJORA/ESTANCAMIENTO/PR",
                "analisis": "<analisis tecnico especifico>",
                "directiva": "<accion inmediata para este grupo muscular>"
            }}
        ],
        "computo_general": {{
            "tonelaje_total": <int>,
            "diagnostico_global": "<estado del SNC y fatiga acumulada>",
            "directiva_maestra": "<ajuste nutricional o de descanso para hoy>"
        }}
    }}
    """

    print("[IA] Iniciando disección detallada por ejercicio...")
    respuesta = modelo.generate_content(prompt_sistema)

    # Limpieza y carga de JSON
    json_crudo = respuesta.text.replace("```json", "").replace("```", "").strip()
    res = json.loads(json_crudo)

    # --- CONSTRUCCIÓN DEL LOG HIPER-ESPECÍFICO ---
    timestamp = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    log_final = f"\n### [ {timestamp} ] REPORTE DE SESIÓN LYFTA\n"

    # Iteramos por cada ejercicio para crear el desglose que pides
    for ex in res['ejercicios']:
        log_final += (
            f"--- EJERCICIO: {ex['nombre'].upper()} ---\n"
            f"Volumen: {ex['volumen_kg']}kg | Progresión: {ex['status']}\n"
            f"Análisis: {ex['analisis']}\n"
            f"Directiva: {ex['directiva']}\n\n"
        )

    # Añadimos el cómputo general al final
    log_final += (
        f"== CÓMPUTO GENERAL DE LA SESIÓN ==\n"
        f"Tonelaje Total: {res['computo_general']['tonelaje_total']}kg\n"
        f"Diagnóstico SNC: {res['computo_general']['diagnostico_global']}\n"
        f"Directiva Maestra: {res['computo_general']['directiva_maestra']}\n"
        f"-------------------------------------------\n"
    )

    # Persistencia en la Memoria Lineal de Drive
    actualizar_memoria_lineal(log_final)

    return res
    
def sincronizar_biometria_fit():
    """
    Fallback alostático vía PULL. Muta el Gemelo Digital.
    """
    try:
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        peso_actual = float(estado["biometria_actual"]["peso_kg"])
        altura_actual = float(estado["biometria_actual"]["altura_cm"])
        edad_actual = int(estado["identidad"]["edad"])

        token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
        if token_env:
            creds = Credentials.from_authorized_user_info(json.loads(token_env))
        else:
            if not os.path.exists(TOKEN_PATH):
                raise FileNotFoundError(f"Falta {TOKEN_PATH} para ejecución local.")
            creds = Credentials.from_authorized_user_file(TOKEN_PATH)

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
        mutacion_requerida = False

        for bucket in response.get('bucket', []):
            for dataset in bucket.get('dataset', []):
                for point in dataset.get('point', []):
                    val = point.get('value', [])[0].get('fpVal')
                    if not val: continue
                    source = dataset.get('dataSourceId', '').lower()

                    if 'weight' in source and round(val, 1) != round(peso_actual, 1):
                        nuevo_peso = round(val, 1)
                        mutacion_requerida = True
                    elif 'height' in source:
                        altura_cm = val * 100 if val < 3.0 else val
                        if round(altura_cm, 1) != round(altura_actual, 1):
                            nueva_altura = round(altura_cm, 1)
                            mutacion_requerida = True

        if mutacion_requerida:
            nueva_proteina = int(nuevo_peso * 2.2)
            nuevo_bmr = recalcular_bmr(nuevo_peso, nueva_altura, edad_actual)
            nuevo_deficit = int(nuevo_bmr - 400)

            estado["biometria_actual"]["peso_kg"] = nuevo_peso
            estado["biometria_actual"]["altura_cm"] = nueva_altura
            estado["restricciones_duras"]["proteina_g"] = nueva_proteina
            estado["restricciones_duras"]["calorias_objetivo"] = nuevo_deficit

            actualizar_estado_maestro(FILE_ID_MAESTRO, estado)

            log_alostasis = f"[ALOSTASIS] Gemelo Digital mutado. Nuevo Peso: {nuevo_peso}kg. Nuevo Déficit: {nuevo_deficit}kcal."
            actualizar_memoria_lineal(log_alostasis)

            print(f"[MUTACIÓN ALOSTÁTICA] Déficit: {nuevo_deficit}kcal | Proteína: {nueva_proteina}g")
            return True

        return False

    except Exception as e:
        print(f"[ERROR DE EXTRACCIÓN FIT] {e}")
        return False
