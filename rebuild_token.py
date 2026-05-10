import os
import sys
from google_auth_oauthlib.flow import InstalledAppFlow

# Scopes innegociables para el ecosistema de 5TB y biometría V12
SCOPES = [
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.activity.write',
    'https://www.googleapis.com/auth/drive.file'
]

CREDENTIALS_FILE = 'credenciales_oauth.json'
TOKEN_FILE = 'token.json'

def generar_llave():
    print("[SISTEMA] Iniciando protocolo de autorización OAuth 2.0...")

    if not os.path.exists(CREDENTIALS_FILE):
        print(f"[ERROR CRÍTICO] Archivo maestro ausente: {CREDENTIALS_FILE}.")
        print("[ACCIÓN] Descarga el archivo desde Google Cloud Console antes de continuar.")
        sys.exit(1)

    try:
        # Forzamos puerto 8080 y personalizamos la respuesta del servidor local
        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
        creds = flow.run_local_server(
            port=8080,
            success_message="Autorizacion de Alto Rendimiento completada. Ya puedes cerrar esta pestana y volver a la terminal."
        )

        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

        print("==================================================")
        print(f"[ÉXITO] {TOKEN_FILE} regenerado y encriptado.")
        print("[INFO] Enlace biométrico con ecosistema 5TB establecido.")
        print("==================================================")

    except Exception as e:
        print(f"[FALLO DE INFRAESTRUCTURA] El puente de seguridad ha sido interrumpido: {e}")
        sys.exit(1)

if __name__ == "__main__":
    generar_llave()
