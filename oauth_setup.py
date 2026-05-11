import os
import sys
from google_auth_oauthlib.flow import InstalledAppFlow

# SCOPES ACTUALIZADOS: Inclusión de temperatura y métricas de recuperación sistémica.
SCOPES = [
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.activity.write',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',
    'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',
    'https://www.googleapis.com/auth/fitness.body_temperature.read', # NUEVO: Para inflamación/sobreentreno
    'https://www.googleapis.com/auth/drive'
]

CREDENTIALS_FILE = 'credenciales_oauth.json'
TOKEN_FILE = 'token.json'

def generar_llave_maestra():
    """Inicia el protocolo de autorización para capturar métricas de rendimiento."""
    print("==================================================")
    print("[SISTEMA] ACTUALIZANDO PROTOCOLO DE ACCESO TOTAL")
    print("==================================================")

    if not os.path.exists(CREDENTIALS_FILE):
        print(f"[ERROR] No se encuentra '{CREDENTIALS_FILE}'.")
        sys.exit(1)

    try:
        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
        creds = flow.run_local_server(
            port=8080,
            success_message="[OK] Acceso biométrico total concedido."
        )

        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

        print(f"\n[ÉXITO] '{TOKEN_FILE}' generado con permisos de salud extendidos.")
    except Exception as e:
        print(f"\n[FALLO] Error en la vinculación: {e}")
        sys.exit(1)

if __name__ == "__main__":
    generar_llave_maestra()
