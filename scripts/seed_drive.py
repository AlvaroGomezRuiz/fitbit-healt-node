"""
Bootstrap del JSON maestro biométrico y subida del CSV histórico.

Uso local (UNA VEZ, después del oauth_setup):
    python -m scripts.seed_drive --bootstrap-json
    python -m scripts.seed_drive --upload-csv
    python -m scripts.seed_drive --generar-perfil

Requiere:
  - token.json en la raíz (generado por scripts/oauth_setup.py)
  - secrets/credenciales_oauth.json
  - FOLDER_SALUD_ID y FILE_ID_MAESTRO en env (o .env)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv  # noqa: E402

# override=True: el .env del proyecto SIEMPRE tiene prioridad sobre variables
# de sesión sueltas (p.ej. un GEMINI_API_KEY=dummy olvidado en PowerShell).
load_dotenv(BASE_DIR / ".env", override=True)

# `setdefault` no funciona si load_dotenv carga la var como string vacío;
# por eso comprobamos truthy + fallback al token.json local.
TOKEN_PATH = BASE_DIR / "token.json"
if TOKEN_PATH.exists() and not os.environ.get("GOOGLE_OAUTH_TOKEN_JSON", "").strip():
    os.environ["GOOGLE_OAUTH_TOKEN_JSON"] = TOKEN_PATH.read_text(encoding="utf-8")

# Saneamos espacios en GEMINI_API_KEY (dotenv conserva el espacio tras `=`).
if "GEMINI_API_KEY" in os.environ:
    os.environ["GEMINI_API_KEY"] = os.environ["GEMINI_API_KEY"].strip()

from src.auth import calcular_edad  # noqa: E402
from src.engines.brain_engine import generar_perfil_atleta_desde_csv  # noqa: E402
from src.engines.drive_engine import (  # noqa: E402
    actualizar_estado_maestro,
    leer_estado_maestro,
    subir_csv_contexto,
)
from src.models import validar  # noqa: E402


def _calcular_macros_cutting_agresivo(peso_kg: float, altura_cm: float, edad: int) -> dict:
    """Mifflin-St Jeor + factor 1.55 + déficit 500 kcal."""
    bmr = 10 * peso_kg + 6.25 * altura_cm - 5 * edad + 5
    tdee = bmr * 1.55
    kcal = round(tdee - 500)
    proteina = round(peso_kg * 2.5)
    grasa = round(peso_kg * 0.8)
    carbos = max(0, round((kcal - proteina * 4 - grasa * 9) / 4))
    return {"kcal": kcal, "proteina": proteina, "grasa": grasa, "carbos": carbos}


def construir_json_maestro_inicial() -> dict:
    peso = float(os.environ.get("PESO_KG_INICIAL", 82))
    altura = float(os.environ.get("ALTURA_CM", 160))
    fecha_nac = os.environ.get("FECHA_NACIMIENTO", "2007-03-05")
    edad = calcular_edad(fecha_nac)
    imc = round(peso / ((altura / 100) ** 2), 1)
    body_fat = float(os.environ.get("BODY_FAT_INICIAL_PCT", 24))
    masa_magra = round(peso * (1 - body_fat / 100), 1)
    macros = _calcular_macros_cutting_agresivo(peso, altura, edad)
    hoy = date.today().isoformat()

    estado = {
        "identidad": {
            "nombre": "Alvaro Gomez Ruiz",
            "fecha_nacimiento": fecha_nac,
            "edad_anos": edad,
            "sexo": "M",
            "altura_cm": altura,
        },
        "biometria_actual": {
            "peso_kg": peso,
            "fecha_ultimo_pesaje": hoy,
            "imc": imc,
            "body_fat_estimado_pct": body_fat,
            "masa_libre_grasa_kg": masa_magra,
            "tendencia_peso_7dias_kg": 0.0,
        },
        "objetivo": {
            "tipo": "CUTTING_AGRESIVO",
            "kcal_target": macros["kcal"],
            "proteina_g": macros["proteina"],
            "grasa_g": macros["grasa"],
            "carbos_g": macros["carbos"],
            "creatina_g": 7,
            "agua_l": 3.5,
            "fecha_ultimo_recalculo": hoy,
        },
        "guardarrailes_activos": {
            "hrv_baseline_7d": None,
            "peso_baseline_2sem": peso,
            "ultimo_top_set_squat": 205.0,
            "ultimo_top_set_press": 100.0,
            "bandera_roja": False,
            "motivo_bandera_roja": None,
            "ultimo_chequeo": f"{hoy}T08:50:00+02:00",
        },
        "memoria_corta_7dias": {
            "sueno_h": [],
            "hrv_ms": [],
            "rpe_promedio": [],
            "adherencia_kcal_pct": [],
        },
    }
    validar(estado)
    return estado


def cmd_bootstrap_json() -> None:
    file_id = os.environ.get("FILE_ID_MAESTRO")
    if not file_id:
        sys.exit("[ERROR] FILE_ID_MAESTRO no en .env")

    try:
        existente = leer_estado_maestro(file_id)
        validar(existente)
        print(f"[OK] BIOMETRIA_MAESTRO ya existe y es válido. Peso: {existente['biometria_actual']['peso_kg']} kg.")
        respuesta = input("¿Sobrescribir? (y/N): ").strip().lower()
        if respuesta != "y":
            return
    except Exception:
        print("[INFO] JSON maestro inválido o ausente. Creando.")

    nuevo = construir_json_maestro_inicial()
    actualizar_estado_maestro(file_id, nuevo)
    print("[OK] BIOMETRIA_MAESTRO inicializado:")
    print(json.dumps(nuevo, indent=2, ensure_ascii=False))


def cmd_upload_csv() -> None:
    ruta = BASE_DIR / "ENTRENOS_ALVARO_GOMEZ_RUIZ.csv"
    if not ruta.exists():
        sys.exit(f"[ERROR] CSV no encontrado: {ruta}")
    fid = subir_csv_contexto(str(ruta))
    print(f"[OK] CSV subido a 00_CONTEXTO_HISTORICO. file_id = {fid}")


def cmd_generar_perfil() -> None:
    if not os.environ.get("GEMINI_API_KEY"):
        sys.exit("[ERROR] GEMINI_API_KEY no en .env")
    ok = generar_perfil_atleta_desde_csv()
    print(f"[{'OK' if ok else 'FALLO'}] Generación PERFIL_ATLETA.md")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--bootstrap-json", action="store_true")
    p.add_argument("--upload-csv", action="store_true")
    p.add_argument("--generar-perfil", action="store_true")
    args = p.parse_args()

    if not any([args.bootstrap_json, args.upload_csv, args.generar_perfil]):
        p.print_help()
        sys.exit(1)

    if args.bootstrap_json:
        cmd_bootstrap_json()
    if args.upload_csv:
        cmd_upload_csv()
    if args.generar_perfil:
        cmd_generar_perfil()


if __name__ == "__main__":
    main()
