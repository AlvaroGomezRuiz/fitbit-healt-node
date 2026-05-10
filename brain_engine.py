import os
import time
from dotenv import set_key, load_dotenv
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ENV_PATH = "/app/.env" if os.path.exists("/app/.env") else ".env"
TOKEN_PATH = "token.json"

def recalcular_bmr(peso, altura, edad):
    # Ecuación de Mifflin-St Jeor con variables 100% dinámicas
    return (10 * peso) + (6.25 * altura) - (5 * edad) + 5

def sincronizar_biometria_fit():
    """
    Extracción Multidimensional (Pull).
    El sistema audita la API central. Si detecta divergencias en la masa o estatura,
    ejecuta una mutación del entorno y recalcula la síntesis proteica requerida.
    """
    if not os.path.exists(ENV_PATH) or not os.path.exists(TOKEN_PATH):
        print(f"[ERROR CRÍTICO] Archivos de entorno inaccesibles.")
        return False

    load_dotenv(ENV_PATH)

    # Lectura del estado biológico actual
    peso_actual = float(os.getenv("WEIGHT_KG", 82))
    altura_actual = float(os.getenv("HEIGHT_CM", 160))
    edad_actual = int(os.getenv("YEARS", 19))

    try:
        creds = Credentials.from_authorized_user_file(TOKEN_PATH)
        fitness_service = build('fitness', 'v1', credentials=creds)

        end_time = int(time.time() * 1000)
        start_time = end_time - 86400000 # Ventana de 24 horas

        # Petición de métricas combinadas (Peso y Altura)
        body = {
            "aggregateBy": [
                {"dataTypeName": "com.google.weight"},
                {"dataTypeName": "com.google.height"}
            ],
            "bucketByTime": {"durationMillis": 86400000},
            "startTimeMillis": start_time,
            "endTimeMillis": end_time
        }

        response = fitness_service.users().dataset().aggregate(userId='me', body=body).execute()

        nuevo_peso = peso_actual
        nueva_altura = altura_actual
        mutacion_requerida = False

        # Minería de orígenes de datos
        for bucket in response.get('bucket', []):
            for dataset in bucket.get('dataset', []):
                for point in dataset.get('point', []):
                    val = point.get('value', [])[0].get('fpVal')
                    if not val:
                        continue

                    source = dataset.get('dataSourceId', '').lower()

                    if 'weight' in source and round(val, 1) != round(peso_actual, 1):
                        nuevo_peso = round(val, 1)
                        mutacion_requerida = True
                    elif 'height' in source:
                        altura_cm = val * 100 if val < 3.0 else val
                        if round(altura_cm, 1) != round(altura_actual, 1):
                            nueva_altura = round(altura_cm, 1)
                            mutacion_requerida = True

        # Ejecución del recálculo orgánico
        if mutacion_requerida:
            nueva_proteina = int(nuevo_peso * 2.2)
            nuevo_bmr = recalcular_bmr(nuevo_peso, nueva_altura, edad_actual)
            nuevo_deficit = int(nuevo_bmr - 400) # Algoritmo de preservación magra

            # Sobrescritura de estado en el nodo
            set_key(ENV_PATH, "WEIGHT_KG", str(nuevo_peso))
            set_key(ENV_PATH, "HEIGHT_CM", str(nueva_altura))
            set_key(ENV_PATH, "PROTEIN_DAILY_DOSE_GRAMS", str(nueva_proteina))
            set_key(ENV_PATH, "CALORIC_TARGET_DEFICIT", str(nuevo_deficit))

            # Aplicación de Hard Constraints (Inyección forzada)
            set_key(ENV_PATH, "CREATINA_DAILY_DOSE_GRAMS", "7")
            set_key(ENV_PATH, "BAN_MAGNESIO", "True")
            set_key(ENV_PATH, "BAN_OMEGA3", "True")

            print(f"[MUTACIÓN ALOSTÁTICA EJECUTADA] Parámetros: {nuevo_peso}kg | {nueva_altura}cm | {edad_actual} años.")
            print(f"[NUEVO OBJETIVO] Déficit: {nuevo_deficit}kcal | Proteína: {nueva_proteina}g")
            return True

        return False

    except Exception as e:
        print(f"[ERROR DE EXTRACCIÓN] {e}")
        return False
