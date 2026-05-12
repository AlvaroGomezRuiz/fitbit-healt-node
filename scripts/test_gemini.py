"""
Smoke test directo de la GEMINI_API_KEY.
Prueba 4 modelos en orden barato → caro. Si TODOS fallan con 401/403 → key inválida.
Si 2.5-flash funciona → la key es buena, solo está limitada en modelos preview.

Uso:
    python -m scripts.test_gemini
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# PowerShell por defecto usa cp1252; las respuestas de Google contienen Unicode.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv  # noqa: E402

# override=True: el .env del proyecto SIEMPRE tiene prioridad sobre variables
# de sesión sueltas (p.ej. un GEMINI_API_KEY=dummy olvidado en PowerShell).
load_dotenv(BASE_DIR / ".env", override=True)

if "GEMINI_API_KEY" in os.environ:
    os.environ["GEMINI_API_KEY"] = os.environ["GEMINI_API_KEY"].strip()

import requests  # noqa: E402

MODELOS = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3.1-pro-preview",
]


def probar(modelo: str, api_key: str) -> tuple[bool, str]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
    payload = {
        "contents": [{"parts": [{"text": "Responde solo con la palabra PONG."}]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 10},
    }
    try:
        r = requests.post(
            url,
            headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
            json=payload,
            timeout=30,
        )
    except requests.RequestException as e:
        return False, f"NETWORK: {type(e).__name__}: {str(e)[:200]}"

    if r.ok:
        try:
            txt = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            return True, f"OK → '{txt}'"
        except Exception as e:
            return False, f"OK pero respuesta inesperada: {e}: {r.text[:200]}"

    return False, f"HTTP {r.status_code}: {r.text[:300]}"


def main() -> None:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        sys.exit("[FATAL] GEMINI_API_KEY no está en .env")

    print(f"[INFO] Probando key: {key[:8]}…{key[-4:]} ({len(key)} chars)")
    print()

    resultados: list[tuple[str, bool, str]] = []
    for m in MODELOS:
        ok, msg = probar(m, key)
        marca = "  OK " if ok else "FAIL "
        print(f"[{marca}] {m:35s} -> {msg[:140]}")
        resultados.append((m, ok, msg))

    print()
    ok_alguno = any(ok for _, ok, _ in resultados)
    if ok_alguno:
        print("[VEREDICTO] La GEMINI_API_KEY es VÁLIDA.")
        no_disponibles = [m for m, ok, _ in resultados if not ok]
        if no_disponibles:
            print(f"   Modelos sin cuota/no accesibles ahora: {', '.join(no_disponibles)}")
        print("   El fallback en brain_engine usará automáticamente el primero que responda.")
    else:
        codigos = {r[2].split(":")[0] for r in resultados if not r[1]}
        if any("HTTP 401" in r[2] or "HTTP 403" in r[2] for r in resultados):
            print("[VEREDICTO] La GEMINI_API_KEY es INVÁLIDA o no autorizada.")
            print("   Genera una nueva en: https://aistudio.google.com/app/apikey")
        else:
            print(f"[VEREDICTO] Todos los modelos fallaron con: {codigos}")


if __name__ == "__main__":
    main()
