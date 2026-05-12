"""
Bootstrap OAuth 2.0 contra Google Health API v4 + Google Drive.

Genera `token.json` en la raíz. Después se sube a Google Secret Manager como
`GOOGLE_OAUTH_TOKEN_JSON` para que Cloud Run lo lea al arrancar.

Pre-requisito:
    `secrets/credenciales_oauth.json` (OAuth 2.0 Client ID tipo Desktop app)
    descargado de Google Cloud Console.

Uso:
    python -m scripts.oauth_setup
"""

import json
import sys
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

BASE_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_FILE = BASE_DIR / "secrets" / "credenciales_oauth.json"
TOKEN_FILE = BASE_DIR / "token.json"

# Scopes Google Health API v4 (los 4 ámbitos completos cubren los 31 data types).
# Drive scope para escribir reportes en tu Drive personal.
SCOPES = [
    "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
    "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
    "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
    "https://www.googleapis.com/auth/googlehealth.nutrition.readonly",
    "https://www.googleapis.com/auth/drive",
]


def generar_llave_maestra() -> None:
    print("=" * 60)
    print("[SETUP] Bootstrap OAuth → Google Health API v4 + Drive")
    print("=" * 60)

    if not CREDENTIALS_FILE.exists():
        print(f"[ERROR] No se encuentra '{CREDENTIALS_FILE}'.")
        print("  1. Ve a https://console.cloud.google.com/apis/credentials")
        print("  2. Crea OAuth 2.0 Client ID tipo 'Desktop app'.")
        print(f"  3. Descarga el JSON y renómbralo a '{CREDENTIALS_FILE.name}'.")
        print(f"  4. Colócalo en {CREDENTIALS_FILE.parent}")
        sys.exit(1)

    try:
        flow = InstalledAppFlow.from_client_secrets_file(
            str(CREDENTIALS_FILE), SCOPES
        )
        creds = flow.run_local_server(
            port=0,
            prompt="consent",
            access_type="offline",
            success_message=(
                "[OK] Autorización concedida. Cierra esta pestaña."
            ),
        )
    except Exception as e:
        print(f"\n[FALLO] Error en el flow OAuth: {e}")
        sys.exit(1)

    TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")

    print(f"\n[OK] Token generado en: {TOKEN_FILE}")
    print("     - access_token: dura 1h (refresh automático)")
    print("     - refresh_token: dura 6 meses sin uso")
    print()
    print("SIGUIENTE PASO (Cloud Run):")
    print(f'  gcloud secrets create google-oauth-token --data-file="{TOKEN_FILE}"')
    print("  gcloud run services update fitbit-node \\")
    print("    --set-secrets=GOOGLE_OAUTH_TOKEN_JSON=google-oauth-token:latest")

    try:
        parsed = json.loads(TOKEN_FILE.read_text(encoding="utf-8"))
        if "refresh_token" not in parsed:
            print(
                "\n[ADVERTENCIA] El token NO contiene refresh_token. "
                "Revoca el acceso en https://myaccount.google.com/permissions "
                "y vuelve a ejecutar este script."
            )
            sys.exit(2)
    except json.JSONDecodeError as e:
        print(f"\n[ERROR] token.json malformado: {e}")
        sys.exit(1)


if __name__ == "__main__":
    generar_llave_maestra()
