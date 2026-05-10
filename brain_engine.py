import time
import os
import json
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from drive_engine import leer_estado_maestro, actualizar_estado_maestro

TOKEN_PATH = "token.json"
FILE_ID_MAESTRO = "1s2GSGjlxChGy39jUxJFDiijBCWKKg-T5"

def recalcular_bmr(peso, altura, edad):
    # Ecuación de Mifflin-St Jeor (Motor Alostático V15)
    return (10 * peso) + (6.25 * altura) - (5 * edad) + 5

def sincronizar_biometria_fit():
    """Mutación V15: Persistencia Absoluta en Google Drive."""
    try:
        # Lectura del estado biológico actual desde la nube
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        peso_actual = float(estado["biometria_actual"]["peso_kg"])
        altura_actual = float(estado["biometria_actual"]["altura_cm"])
        edad_actual = int(estado["identidad"]["edad"])

        token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
        if token_env:
            # Modo V15 Producción
            creds = Credentials.from_authorized_user_info(json.loads(token_env))
        else:
            # Modo Desarrollo Local
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
        print(f"[ERROR DE EXTRACCIÓN] {e}")
        return False
