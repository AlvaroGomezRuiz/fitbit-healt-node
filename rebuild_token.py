import os
import sys
from google_auth_oauthlib.flow import InstalledAppFlow

# SCOPES V15: Acceso total a salud y archivos.
# Estos permisos son obligatorios para que Gemini pueda leer tu VFC,
# tu SpO2 y organizar tus carpetas de entrenamiento.
SCOPES = [
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.activity.write',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',       # Fatiga del SNC
    'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',# Recuperación SpO2
    'https://www.googleapis.com/auth/drive'                          # Gestión del Data Lake
]

CREDENTIALS_FILE = 'credenciales_oauth.json'
TOKEN_FILE = 'token.json'

def generar_llave_maestra():
    """
    Inicia el flujo de autorización OAuth 2.0.
    """
    print("==================================================")
    print("[SISTEMA] INICIANDO PROTOCOLO DE ACCESO V15")
    print("==================================================")

    if not os.path.exists(CREDENTIALS_FILE):
        print(f"[ERROR CRÍTICO] No se encuentra el archivo '{CREDENTIALS_FILE}'.")
        print("[AYUDA] Ve a Google Cloud Console, descarga tu 'Cliente OAuth' e insértalo aquí.")
        sys.exit(1)

    try:
        # Iniciamos el servidor local para la validación
        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
        creds = flow.run_local_server(
            port=8080,
            success_message="[V15 OK] Acceso concedido. El puente de datos está activo. Cierra esta pestaña."
        )

        # Generamos el archivo token.json que usarás en la nube
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

        print("\n==================================================")
        print(f"[ÉXITO] '{TOKEN_FILE}' GENERADO CORRECTAMENTE.")
        print("--------------------------------------------------")
        print("PASOS FINALES PARA EL DESPLIEGUE:")
        print("1. Abre 'token.json' y copia TODO su contenido.")
        print("2. Ve a tu panel de Google Cloud Run.")
        print("3. Pega el contenido en la variable: GOOGLE_OAUTH_TOKEN_JSON")
        print("4. ¡Tu Coach ya tiene permiso para operar!")
        print("==================================================")

    except Exception as e:
        print(f"\n[FALLO DE SEGURIDAD] No se pudo establecer la conexión: {e}")
        sys.exit(1)

if __name__ == "__main__":
    generar_llave_maestra()
