import os
import re
from dotenv import set_key, load_dotenv

# Detección dinámica: '/app/.env' en la nube, '.env' en tu PC
ENV_PATH = "/app/.env" if os.path.exists("/app/.env") else ".env"

def recalcular_bmr(peso, altura, edad):
    # Ecuación de Mifflin-St Jeor anclada al perfil de hipertrofia
    return (10 * peso) + (6.25 * altura) - (5 * edad) + 5

def procesar_bitacora_y_mutar(texto_crudo):
    if not os.path.exists(ENV_PATH):
        print(f"[ERROR CRÍTICO] Archivo de entorno inaccesible en {ENV_PATH}")
        return False

    load_dotenv(ENV_PATH)

    # Expresión regular robusta: Captura decimales y múltiples sintaxis
    match_peso = re.search(r'(?:peso|bajado a|subido a|estoy en)\s*(\d{2,3}(?:[.,]\d{1,2})?)', texto_crudo.lower())

    if match_peso:
        try:
            # Normalización de coma a punto para conversión matemática
            nuevo_peso = float(match_peso.group(1).replace(',', '.'))

            # Recálculo exacto (preservación en déficit)
            nueva_proteina = int(nuevo_peso * 2.2)
            nuevo_bmr = recalcular_bmr(nuevo_peso, 160, 19)

            # Mutación de variables de estado
            set_key(ENV_PATH, "WEIGHT_KG", str(nuevo_peso))
            set_key(ENV_PATH, "PROTEIN_DAILY_DOSE_GRAMS", str(nueva_proteina))
            set_key(ENV_PATH, "CALORIC_TARGET_DEFICIT", str(int(nuevo_bmr - 400)))

            # Blindaje de Hard Constraints (Innegociable)
            set_key(ENV_PATH, "CREATINA_DAILY_DOSE_GRAMS", "7")
            set_key(ENV_PATH, "BAN_MAGNESIO", "True")
            set_key(ENV_PATH, "BAN_OMEGA3", "True")

            # Salida estándar interceptada automáticamente por Google Cloud Logging
            print(f"[MUTACIÓN EJECUTADA] Biometría actualizada: Peso {nuevo_peso}kg | Proteína {nueva_proteina}g | Déficit {int(nuevo_bmr - 400)}kcal")
            return True

        except Exception as e:
            print(f"[ERROR DE MUTACIÓN] Fallo estructural al sobreescribir variables: {e}")
            return False
    else:
        print("[INFO] No se detectaron comandos de mutación en la telemetría de voz.")
        return False
