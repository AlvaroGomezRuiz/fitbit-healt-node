"""
Diagnóstico DeepSeek API.

Prueba la DEEPSEEK_API_KEY contra V4-Pro y V4-Flash:
  - Confirma que la key es válida (no devuelve 401).
  - Confirma que hay saldo (no devuelve 402).
  - Mide latencia de un round-trip mínimo (1 token).

Uso (con .env cargado):
    python -m scripts.test_deepseek
"""

from __future__ import annotations

import os
import sys
import time

import requests
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
load_dotenv(override=True)

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
MODELOS = ["deepseek-v4-pro", "deepseek-v4-flash"]


def probar(modelo: str, api_key: str) -> None:
    payload = {
        "model": modelo,
        "messages": [{"role": "user", "content": "Responde solo con OK."}],
        "max_tokens": 16,
        "temperature": 0,
        "stream": False,
    }
    t0 = time.time()
    try:
        resp = requests.post(
            DEEPSEEK_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            json=payload,
            timeout=30,
        )
        elapsed_ms = int((time.time() - t0) * 1000)
    except Exception as e:
        print(f"  [{modelo}] ERROR conexion: {type(e).__name__}: {e}")
        return

    if resp.status_code == 200:
        data = resp.json()
        try:
            texto = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            print(
                f"  [{modelo}] OK  {elapsed_ms} ms  ->  "
                f"in={usage.get('prompt_tokens')} out={usage.get('completion_tokens')}  "
                f"resp={texto.strip()[:40]!r}"
            )
        except (KeyError, IndexError):
            print(f"  [{modelo}] HTTP 200 pero respuesta malformada: {data}")
    elif resp.status_code == 401:
        print(f"  [{modelo}] HTTP 401  ->  API key INVALIDA")
    elif resp.status_code == 402:
        print(f"  [{modelo}] HTTP 402  ->  SALDO AGOTADO (recarga en platform.deepseek.com)")
    elif resp.status_code == 429:
        print(f"  [{modelo}] HTTP 429  ->  rate limit / saldo bajo: {resp.text[:200]}")
    else:
        print(f"  [{modelo}] HTTP {resp.status_code}: {resp.text[:200]}")


def main() -> None:
    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    if not api_key:
        print("[ERROR] DEEPSEEK_API_KEY no en .env")
        sys.exit(1)
    if api_key in ("PEGA_TU_KEY_AQUI", "sk-..."):
        print(f"[ERROR] DEEPSEEK_API_KEY tiene valor placeholder ({api_key!r}). Rellena tu key real.")
        sys.exit(1)
    print(f"DEEPSEEK_API_KEY detectada ({len(api_key)} chars, prefijo {api_key[:6]}...)")
    print(f"Probando contra {DEEPSEEK_URL}\n")
    for m in MODELOS:
        probar(m, api_key)


if __name__ == "__main__":
    main()
