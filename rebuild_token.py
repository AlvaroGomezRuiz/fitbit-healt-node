import os
import sys
from google_auth_oauthlib.flow import InstalledAppFlow

# SCOPES V15: Cobertura total de la API de Google Fitness y Drive.
# Requisito estricto para análisis de VFC, SpO2 y persistencia en Data Lake.
SCOPES = [
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.activity.write',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',       # Nivel V15: Variabilidad Cardiaca
    'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',# Nivel V15: SpO2
    'https://www.googleapis.com/auth/drive'                          # Nivel V15: Lectura/Escritura Absoluta
]

CREDENTIALS_FILE = 'credenciales_oauth.json'
TOKEN_FILE = 'token.json'

def generar_llave():
    print("==================================================")
    print("[SISTEMA] Iniciando protocolo de autorización OAuth 2.0 (V15)...")
    print("==================================================")

    if not os.path.exists(CREDENTIALS_FILE):
        print(f"[ERROR CRÍTICO] Archivo maestro ausente: {CREDENTIALS_FILE}.")
        print("[ACCIÓN] Descarga el cliente OAuth desde Google Cloud Console e insértalo en la raíz.")
        sys.exit(1)

    try:
        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
        creds = flow.run_local_server(
            port=8080,
            success_message="[V15 OK] Autorización biométrica y de infraestructura completada. Cierra esta ventana."
        )

        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

        print("\n==================================================")
        print(f"[ÉXITO] {TOKEN_FILE} REGENERADO.")
        print("[INFO] El payload contiene el Refresh Token. Listo para inyección en variables de entorno.")
        print("==================================================")

    except Exception as e:
        print(f"\n[FALLO DE INFRAESTRUCTURA] Colapso en el puente de seguridad: {e}")
        sys.exit(1)

if __name__ == "__main__":
    generar_llave()
