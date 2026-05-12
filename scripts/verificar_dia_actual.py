"""
Inspecciona la carpeta del DÍA ACTUAL en Drive (formato DD_MM_YYYY)
y lista los archivos generados en cada subcarpeta.

Uso:
    python -m scripts.verificar_dia_actual
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BASE_DIR / ".env", override=True)

TOKEN_PATH = BASE_DIR / "token.json"
if TOKEN_PATH.exists() and not os.environ.get("GOOGLE_OAUTH_TOKEN_JSON", "").strip():
    os.environ["GOOGLE_OAUTH_TOKEN_JSON"] = TOKEN_PATH.read_text(encoding="utf-8")

import pytz  # noqa: E402

from src.engines.drive_engine import (  # noqa: E402
    MESES,
    _root_salud,
    obtener_servicio_drive,
)

ZONA = pytz.timezone("Europe/Madrid")
SUBCARPETAS = ["01_LYFTA_RAW", "02_RESUMEN_DIARIO_IA", "03_MOTOR_IA_LOGS", "04_HEALTH_RAW"]


def _buscar(drive, nombre, parent_id, mime_carpeta=True):
    q = f"name='{nombre}' and '{parent_id}' in parents and trashed=false"
    if mime_carpeta:
        q += " and mimeType='application/vnd.google-apps.folder'"
    res = drive.files().list(q=q, fields="files(id)").execute()
    archivos = res.get("files", [])
    return archivos[0]["id"] if archivos else None


def _listar(drive, parent_id):
    res = drive.files().list(
        q=f"'{parent_id}' in parents and trashed=false",
        fields="files(id,name,mimeType,createdTime,modifiedTime,size)",
        orderBy="modifiedTime desc",
        pageSize=100,
    ).execute()
    return res.get("files", [])


def main() -> None:
    ahora = datetime.now(ZONA)
    nombre_dia = ahora.strftime("%d_%m_%Y")
    nombre_mes = MESES[ahora.month]
    print(f"[INFO] Verificando ruta: {ahora.year} > {nombre_mes} > {nombre_dia}\n")

    drive = obtener_servicio_drive()
    root = _root_salud()

    id_anio = _buscar(drive, str(ahora.year), root)
    if not id_anio:
        print(f"[FAIL] No existe carpeta {ahora.year} en SALUD root."); return
    print(f"  [OK] {ahora.year} -> {id_anio}")

    id_mes = _buscar(drive, nombre_mes, id_anio)
    if not id_mes:
        print(f"[FAIL] No existe carpeta {nombre_mes}."); return
    print(f"  [OK] {nombre_mes} -> {id_mes}")

    id_dia = _buscar(drive, nombre_dia, id_mes)
    if not id_dia:
        print(f"[FAIL] No existe carpeta del día {nombre_dia}."); return
    print(f"  [OK] {nombre_dia} -> {id_dia}\n")

    for sub in SUBCARPETAS:
        sid = _buscar(drive, sub, id_dia)
        if not sid:
            print(f"  [---] {sub}: (no existe aún)")
            continue
        items = _listar(drive, sid)
        print(f"  [{len(items):>3}] {sub}:")
        for it in items[:20]:
            tipo = "[D]" if it["mimeType"] == "application/vnd.google-apps.folder" else "[F]"
            tam = it.get("size", "-")
            print(f"        {tipo} {it['name']} ({tam}B, mod={it['modifiedTime']})")
        if len(items) > 20:
            print(f"        ... y {len(items) - 20} más")


if __name__ == "__main__":
    main()
