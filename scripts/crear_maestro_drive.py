"""
Crea (o sobrescribe) BIOMETRIA_MAESTRO.json en 00_CONTEXTO_HISTORICO/.

Útil en dos casos:
1. Primer arranque del proyecto (cuando aún no hay JSON maestro).
2. Recuperación: el FILE_ID_MAESTRO de la env var apunta a un archivo que ya
   no existe (borrado, fuera de papelera, etc.).

Tras crear, imprime el nuevo file_id para que lo actualices en Cloud Run con:
    gcloud run services update fitbit-node --region=europe-west1 \
        --update-env-vars=FILE_ID_MAESTRO=<id>

Uso:
    python -m scripts.crear_maestro_drive
"""
from __future__ import annotations
import io
import json
import os
import sys
from datetime import date
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(BASE_DIR / ".env", override=True)
TOKEN_PATH = BASE_DIR / "token.json"
if TOKEN_PATH.exists() and not os.environ.get("GOOGLE_OAUTH_TOKEN_JSON", "").strip():
    os.environ["GOOGLE_OAUTH_TOKEN_JSON"] = TOKEN_PATH.read_text(encoding="utf-8")

from googleapiclient.http import MediaIoBaseUpload  # noqa: E402

from src.auth import calcular_edad  # noqa: E402
from src.engines.drive_engine import obtener_servicio_drive, resolver_ruta_contexto  # noqa: E402
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
    """Construye el estado biométrico inicial a partir de env vars."""
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


def main() -> None:
    drive = obtener_servicio_drive()
    id_ctx = resolver_ruta_contexto()
    print(f"00_CONTEXTO_HISTORICO id = {id_ctx}")

    estado = construir_json_maestro_inicial()
    print(f"\nEstado biométrico inicial:\n{json.dumps(estado, indent=2, ensure_ascii=False)}")

    datos = json.dumps(estado, indent=2, ensure_ascii=False).encode("utf-8")
    nombre = "BIOMETRIA_MAESTRO.json"

    # Si ya existe en la carpeta, lo actualizamos (no creamos duplicado).
    q = f"name='{nombre}' and '{id_ctx}' in parents and trashed=false"
    r = drive.files().list(q=q, fields="files(id,name)").execute()
    existentes = r.get("files", [])
    media = MediaIoBaseUpload(io.BytesIO(datos), mimetype="application/json")

    if existentes:
        fid = existentes[0]["id"]
        drive.files().update(fileId=fid, media_body=media).execute()
        print(f"\n[OK] Sobrescrito {nombre} existente. file_id={fid}")
    else:
        meta = {"name": nombre, "parents": [id_ctx]}
        fid = drive.files().create(body=meta, media_body=media, fields="id").execute()["id"]
        print(f"\n[OK] Creado {nombre} nuevo. file_id={fid}")

    print(f"\n>>> ACTUALIZAR Cloud Run con:\n"
          f"    gcloud run services update fitbit-node --region=europe-west1 "
          f"--project=fitbit-healt-node "
          f"--update-env-vars=FILE_ID_MAESTRO={fid}\n")

    print(">>> ACTUALIZAR .env local con:\n"
          f"    FILE_ID_MAESTRO={fid}")


if __name__ == "__main__":
    main()
