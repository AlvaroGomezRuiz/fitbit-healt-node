import os
import sys
from google_auth_oauthlib.flow import InstalledAppFlow

# SCOPES V15 ACTUALIZADOS: Se cambia drive.file por drive (Full Access)
# Esto es necesario para que el servidor pueda leer el JSON que tú subiste manualmente.
SCOPES = [
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.activity.write',
    'https://www.googleapis.com/auth/drive' # <--- Scope de Máxima Autoridad
]

CREDENTIALS_FILE = 'credenciales_oauth.json'
TOKEN_FILE = 'token.json'

def generar_llave():
    print("==================================================")
    print("[SISTEMA] Iniciando protocolo de autorización V15...")
    print("==================================================")

    if not os.path.exists(CREDENTIALS_FILE):
        print(f"[ERROR CRÍTICO] Archivo maestro ausente: {CREDENTIALS_FILE}.")
        print("[ACCIÓN] Asegúrate de que el JSON de credenciales esté en la raíz del proyecto.")
        sys.exit(1)

    try:
        # Iniciamos el flujo con los nuevos Scopes de visibilidad total
        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
        creds = flow.run_local_server(
            port=8080,
            success_message="[V15 OK] Autorización de Alto Rendimiento completada. Ya puedes volver a la terminal."
        )

        # Guardamos el nuevo token.json con el Refresh Token incluido
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

        print("\n==================================================")
        print(f"[ÉXITO] {TOKEN_FILE} REGENERADO CON ACCESO TOTAL.")
        print("[INFO] El servidor ahora tiene visibilidad sobre archivos externos.")
        print("==================================================")

    except Exception as e:
        print(f"\n[FALLO DE INFRAESTRUCTURA] Error en el puente de seguridad: {e}")
        sys.exit(1)

if __name__ == "__main__":
    generar_llave()
