import os
import sys
import json
from google_auth_oauthlib.flow import InstalledAppFlow

# SCOPES V15: Cobertura total para Biometría Avanzada e Infraestructura.
# Estos permisos permiten analizar VFC, SpO2 y gestionar tu Data Lake en Drive.
SCOPES = [
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.activity.write',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',       # VFC (Variabilidad Cardíaca)
    'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',# SpO2 (Oxígeno)
    'https://www.googleapis.com/auth/drive'                          # Control de Carpetas y Archivos
]

CREDENTIALS_FILE = 'credenciales_oauth.json'
TOKEN_FILE = 'token.json'

def generar_llave():
    """
    Protocolo de autorización OAuth 2.0.
    Ejecuta esto en local para obtener el token que luego subirás a Cloud Run.
    """
    print("==================================================")
    print("[SISTEMA] INICIANDO PROTOCOLO DE AUTORIZACIÓN V15")
    print("==================================================")

    if not os.path.exists(CREDENTIALS_FILE):
        print(f"[ERROR CRÍTICO] No se encuentra '{CREDENTIALS_FILE}'.")
        print("[AYUDA] Descarga el JSON de 'ID de cliente de OAuth 2.0' desde Google Cloud Console.")
        sys.exit(1)

    try:
        # Iniciamos el flujo de autorización
        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)

        # Abrimos el navegador en el puerto 8080
        creds = flow.run_local_server(
            port=8080,
            success_message="[V15 OK] Autorización completada con éxito. Ya puedes cerrar esta pestaña."
        )

        # Guardamos el token resultante
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

        print("\n==================================================")
        print(f"[ÉXITO] ARCHIVO '{TOKEN_FILE}' GENERADO.")
        print("--------------------------------------------------")
        print("INSTRUCCIONES FINALES:")
        print("1. Abre el archivo 'token.json' y copia TODO su contenido.")
        print("2. Ve a la consola de Google Cloud Run.")
        print("3. Pega el contenido en la variable de entorno: GOOGLE_OAUTH_TOKEN_JSON")
        print("4. Despliega la nueva revisión.")
        print("==================================================")

    except Exception as e:
        print(f"\n[FALLO] Error en el puente de seguridad: {e}")
        sys.exit(1)

if __name__ == "__main__":
    generar_llave()
