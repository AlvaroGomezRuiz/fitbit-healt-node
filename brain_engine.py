import os
import time
from dotenv import set_key, load_dotenv
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# Detección dinámica de entorno
ENV_PATH = "/app/.env" if os.path.exists("/app/.env") else ".env"
TOKEN_PATH = "token.json"

def recalcular_bmr(peso, altura, edad):
    # Ecuación de Mifflin-St Jeor anclada al perfil de hipertrofia (160cm, 19 años)
    return (10 * peso) + (6.25 * altura) - (5 * edad) + 5

def sincronizar_biometria_fit():
    """
    Extracción (Pull) directa desde Google Fitness API.
    Si el Asistente de Fitbit registró un nuevo peso, el nodo se recalibra solo.
    """
    if not os.path.exists(ENV_PATH) or not os.path.exists(TOKEN_PATH):
        print(f"[ERROR CRÍTICO] Falta archivo .env o token.json. Abortando sincronización.")
        return False

    load_dotenv(ENV_PATH)
    peso_actual_env = float(os.getenv("WEIGHT_KG", 82))

    try:
        # 1. Autorización de lectura en Google Fit
        creds = Credentials.from_authorized_user_file(TOKEN_PATH)
        fitness_service = build('fitness', 'v1', credentials=creds)

        # 2. Ventana de extracción: Últimas 24 horas (en milisegundos)
        end_time = int(time.time() * 1000)
        start_time = end_time - 86400000

        # Petición de agregación de la métrica 'com.google.weight'
        body = {
            "aggregateBy": [{"dataTypeName": "com.google.weight"}],
            "bucketByTime": {"durationMillis": 86400000},
            "startTimeMillis": start_time,
            "endTimeMillis": end_time
        }

        response = fitness_service.users().dataset().aggregate(userId='me', body=body).execute()

        # 3. Minería del payload de respuesta
        nuevo_peso = None
        for bucket in response.get('bucket', []):
            for dataset in bucket.get('dataset', []):
                for point in dataset.get('point', []):
                    for value in point.get('value', []):
                        nuevo_peso = value.get('fpVal')

        # 4. Lógica de Mutación y Blindaje
        if nuevo_peso and round(nuevo_peso, 1) != round(peso_actual_env, 1):
            nuevo_peso = round(nuevo_peso, 1)

            # Recálculo exacto (preservación en déficit)
            nueva_proteina = int(nuevo_peso * 2.2)
            nuevo_bmr = recalcular_bmr(nuevo_peso, 160, 19)

            # Mutación física de variables
            set_key(ENV_PATH, "WEIGHT_KG", str(nuevo_peso))
            set_key(ENV_PATH, "PROTEIN_DAILY_DOSE_GRAMS", str(nueva_proteina))
            set_key(ENV_PATH, "CALORIC_TARGET_DEFICIT", str(int(nuevo_bmr - 400)))

            # Blindaje de Hard Constraints (Innegociable)
            set_key(ENV_PATH, "CREATINA_DAILY_DOSE_GRAMS", "7")
            set_key(ENV_PATH, "BAN_MAGNESIO", "True")
            set_key(ENV_PATH, "BAN_OMEGA3", "True")

            print(f"[MUTACIÓN AUTÓNOMA] API Fit detectó cambio. Nuevo Peso: {nuevo_peso}kg | Proteína: {nueva_proteina}g | Déficit: {int(nuevo_bmr - 400)}kcal")
            return True
        else:
            print("[INFO] Biometría estable. No hay divergencia entre Google Fit y el Nodo de 5TB.")
            return False

    except Exception as e:
        print(f"[ERROR DE EXTRACCIÓN] Fallo al leer API de Google Fit: {e}")
        return False
