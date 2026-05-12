"""
Gestión centralizada de credenciales OAuth 2.0 + utilidades de identidad atlética.

Toda la pila (Drive + Google Health API v4 + Gemini headers) usa el mismo
refresh_token. Este módulo:
  1. Lee el JSON OAuth desde la env var GOOGLE_OAUTH_TOKEN_JSON.
  2. Refresca el access_token automáticamente si está caducado.
  3. Cachea credenciales en memoria (thread-safe).
  4. Calcula la edad dinámicamente desde FECHA_NACIMIENTO.

En Cloud Run, GOOGLE_OAUTH_TOKEN_JSON se inyecta vía:
    --set-secrets=GOOGLE_OAUTH_TOKEN_JSON=google-oauth-token:latest
"""

import json
import os
import threading
from datetime import date, datetime

from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials

_CREDS_CACHE: Credentials | None = None
_CACHE_LOCK = threading.Lock()


def obtener_credenciales_validas() -> Credentials:
    """
    Devuelve credenciales OAuth válidas (refrescadas si hace falta).
    Thread-safe.

    Raises:
        RuntimeError: si GOOGLE_OAUTH_TOKEN_JSON no está inyectado, malformado,
                      o el refresh_token está revocado.
    """
    global _CREDS_CACHE

    with _CACHE_LOCK:
        if _CREDS_CACHE is None:
            token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
            if not token_env:
                raise RuntimeError(
                    "GOOGLE_OAUTH_TOKEN_JSON no inyectado. "
                    "En Cloud Run debe venir de Secret Manager."
                )
            try:
                info = json.loads(token_env)
            except json.JSONDecodeError as e:
                raise RuntimeError(f"GOOGLE_OAUTH_TOKEN_JSON malformado: {e}")

            _CREDS_CACHE = Credentials.from_authorized_user_info(info)

        if not _CREDS_CACHE.valid:
            if _CREDS_CACHE.expired and _CREDS_CACHE.refresh_token:
                _CREDS_CACHE.refresh(GoogleAuthRequest())
            else:
                raise RuntimeError(
                    "Credenciales OAuth inválidas y sin refresh_token utilizable. "
                    "Vuelve a ejecutar scripts/oauth_setup.py."
                )

        return _CREDS_CACHE


def obtener_access_token() -> str:
    """Atajo: devuelve solo el access_token (string) ya refrescado."""
    return obtener_credenciales_validas().token


def calcular_edad(fecha_nacimiento_iso: str | None = None, hoy: date | None = None) -> int:
    """
    Calcula la edad EXACTA en años a partir de FECHA_NACIMIENTO (ISO YYYY-MM-DD).
    Si no se pasa argumento lee la env var FECHA_NACIMIENTO.

    El sistema se auto-actualiza el día del cumpleaños sin redeploy.
    """
    iso = fecha_nacimiento_iso or os.environ.get("FECHA_NACIMIENTO", "2007-03-05")
    nacimiento = datetime.strptime(iso, "%Y-%m-%d").date()
    hoy = hoy or date.today()
    edad = hoy.year - nacimiento.year
    if (hoy.month, hoy.day) < (nacimiento.month, nacimiento.day):
        edad -= 1
    return edad
