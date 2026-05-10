import time
import os
import json
import google.generativeai as genai
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from drive_engine import leer_estado_maestro, actualizar_estado_maestro

# Configuración del Motor Cognitivo
genai.configure(api_key=os.environ.get("GEMINI_API_KEY")) # pyright: ignore[reportPrivateImportUsage]

TOKEN_PATH = "token.json"
FILE_ID_MAESTRO = "1POEuCbmOEIURg7UycPsbIrH62uQvJgLI"

def recalcular_bmr(peso, altura, edad):
    # Ecuación de Mifflin-St Jeor (Motor Alostático V15)
    return (10 * peso) + (6.25 * altura) - (5 * edad) + 5

def sincronizar_biometria_fit():
    """Mutación V15: Persistencia Absoluta en Google Drive."""
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
            print(f"[MUTACIÓN ALOSTÁTICA] Déficit: {nuevo_deficit}kcal | Proteína: {nueva_proteina}g")
            return True

        return False

    except Exception as e:
        print(f"[ERROR DE EXTRACCIÓN FIT] {e}")
        return False

def procesar_entrenamiento_llm(csv_text, estado_maestro):
    """
    Motor de Inferencia Gemini (Arquitectura Asíncrona V15).
    Prompt estructurado en inglés para maximizar el rendimiento del LLM.
    """
    modelo = genai.GenerativeModel('gemini-1.5-pro') # pyright: ignore[reportPrivateImportUsage]

    peso_actual = estado_maestro['biometria_actual'].get('peso_kg', 'N/A')
    deficit_obj = estado_maestro['restricciones_duras'].get('calorias_objetivo', 'N/A')

    prompt_sistema = f"""
    System Context: You are the core cognitive engine for Google Health Premium, operating as an elite AI coach specializing in hypertrophy, allostasis, and neuromuscular recovery.

    User Profile & Constraints:
    - Training Protocol: Strict 5-day/week hypertrophy split.
    - Current Weight: {peso_actual} kg.
    - Caloric Deficit Target: {deficit_obj} kcal.
    - Active Supplement Stack: Magnesium Bisglycinate, Omega-3, Creatine.

    Raw Workout Data (CSV format from Lyfta):
    {csv_text}

    Execution Requirements:
    1. Parse the CSV to calculate total tonnage and identify the primary muscular group or movement pattern (e.g., Push, Pull, Legs).
    2. Correlate the neuromuscular demand (RPE, volume) with the user's biological constraints.
    3. Generate a strict recovery directive. If severe CNS suppression is detected from the load, mandate an adjustment in sleep cycles or indicate specific replenishment needs for the active supplement stack.
    4. LANGUAGE CONSTRAINT: You must process the logic in English, but ALL string values output in the JSON MUST be written in fluent, technical Spanish.

    Output Format Requirements:
    You must return a valid JSON object ONLY, adhering exactly to the following schema. Do not use Markdown formatting blocks (```json) in the final output string.

    {{
        "grupo_muscular": "<string in Spanish>",
        "tonelaje_estimado": <number>,
        "diagnostico_fatiga": "<string in Spanish, max 3 sentences>",
        "directiva_recuperacion": "<string in Spanish, specific actionable advice>"
    }}
    """

    respuesta = modelo.generate_content(prompt_sistema)

    # Saneamiento del payload de salida
    json_crudo = respuesta.text.strip()
    if json_crudo.startswith("```json"):
        json_crudo = json_crudo[7:]
    if json_crudo.endswith("```"):
        json_crudo = json_crudo[:-3]

    return json.loads(json_crudo.strip())
