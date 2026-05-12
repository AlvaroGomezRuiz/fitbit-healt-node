"""
Refresca TODO el contexto histórico del atleta en Drive en una pasada:

1. Sube/sobrescribe `ENTRENOS_ALVARO_GOMEZ_RUIZ.csv` en 00_CONTEXTO_HISTORICO/.
2. Sube/sobrescribe `RUTINA_OFICIAL.md` (de la raíz del repo) en 00_CONTEXTO_HISTORICO/.
3. Fracciona el CSV por fecha y sube un archivo TXT-Lyfta por cada sesión en
   `AÑO/MES/DD_MM_YYYY/01_LYFTA_RAW/HISTORICO_LYFTA_DD_MM_YYYY.txt`.
4. Opcional `--regenerar-perfil`: regenera `PERFIL_ATLETA.md` con DeepSeek-Pro.

Uso:
    python -m scripts.actualizar_contexto_drive
    python -m scripts.actualizar_contexto_drive --regenerar-perfil
    python -m scripts.actualizar_contexto_drive --csv RUTINA/ENTRENOS_ALVARO_GOMEZ_RUIZ.csv

Idempotente: si vuelve a ejecutarse, sobrescribe en vez de duplicar.
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BASE_DIR / ".env", override=True)

TOKEN_PATH = BASE_DIR / "token.json"
if TOKEN_PATH.exists() and not os.environ.get("GOOGLE_OAUTH_TOKEN_JSON", "").strip():
    os.environ["GOOGLE_OAUTH_TOKEN_JSON"] = TOKEN_PATH.read_text(encoding="utf-8")

if "DEEPSEEK_API_KEY" in os.environ:
    os.environ["DEEPSEEK_API_KEY"] = os.environ["DEEPSEEK_API_KEY"].strip()

from googleapiclient.http import MediaIoBaseUpload  # noqa: E402

from src.engines.brain_engine import generar_perfil_atleta_desde_csv  # noqa: E402
from src.engines.drive_engine import (  # noqa: E402
    guardar_rutina_oficial,
    obtener_servicio_drive,
    resolver_ruta_diaria,
    subir_csv_contexto,
)


def _fmt_set(set_type: str, weight: str, reps: str) -> str:
    """Convierte un set CSV a línea humana tipo Lyfta."""
    abrev = {
        "WARMUP_SET": "W",
        "FEEDER_SET": "F",
        "TOP_SET": "T",
        "BACK_OFF_SET": "B",
        "DROP_SET": "D",
        "NORMAL_SET": "·",
        "FAILURE_SET": "X",
    }.get(set_type.strip(), "·")
    try:
        w = float(weight)
        w_str = f"{w:g}"
    except ValueError:
        w_str = weight or "—"
    return f"  [{abrev}] {w_str} kg × {reps} reps"


def _construir_txt_dia(filas_dia: list[dict]) -> str:
    """Genera el TXT humano-legible de la sesión completa."""
    fila0 = filas_dia[0]
    titulo = fila0.get("Title", "ENTRENO").strip()
    fecha_iso = fila0["Date"][:10]
    duracion = fila0.get("Duration", "").strip()
    fecha_es = datetime.strptime(fecha_iso, "%Y-%m-%d").strftime("%d/%m/%Y")

    out: list[str] = [
        f"# {titulo} — {fecha_es}",
        f"# Duración: {duracion}",
        f"# Total sets registrados: {len(filas_dia)}",
        "",
    ]

    ejercicio_actual: str | None = None
    for f in filas_dia:
        ex = (f.get("Exercise") or "").strip()
        if ex != ejercicio_actual:
            out.append("")
            out.append(f"## {ex}")
            ejercicio_actual = ex
        out.append(_fmt_set(f.get("Set Type", ""), f.get("Weight", ""), f.get("Reps", "")))

    out.append("")
    out.append("# Fuente: export Lyfta histórico (CSV).")
    return "\n".join(out)


def fraccionar_csv_por_dias(ruta_csv: Path) -> dict[str, str]:
    """
    Lee el CSV completo y devuelve dict {fecha_iso: contenido_txt}.
    El CSV tiene cabecera con espacio inicial ("` Title`") en la 1ª columna.
    """
    contenido: dict[str, list[dict]] = defaultdict(list)

    with ruta_csv.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh, skipinitialspace=True)
        # Normalizar nombres de columna (la cabecera trae espacio raro)
        if reader.fieldnames:
            reader.fieldnames = [c.strip() for c in reader.fieldnames]
        for row in reader:
            fecha_raw = (row.get("Date") or "").strip().strip('"')
            if not fecha_raw or len(fecha_raw) < 10:
                continue
            fecha_iso = fecha_raw[:10]
            contenido[fecha_iso].append(row)

    return {iso: _construir_txt_dia(filas) for iso, filas in contenido.items()}


def _upsert_archivo_en_carpeta(
    drive, parent_id: str, nombre: str, datos_bytes: bytes, mimetype: str
) -> tuple[str, bool]:
    """Crea o actualiza un archivo en una carpeta. Devuelve (file_id, created)."""
    q = f"name='{nombre}' and '{parent_id}' in parents and trashed=false"
    res = drive.files().list(q=q, fields="files(id)").execute()
    media = MediaIoBaseUpload(io.BytesIO(datos_bytes), mimetype=mimetype)
    if res.get("files"):
        fid = res["files"][0]["id"]
        drive.files().update(fileId=fid, media_body=media).execute()
        return fid, False
    fid = drive.files().create(
        body={"name": nombre, "parents": [parent_id]}, media_body=media, fields="id"
    ).execute()["id"]
    return fid, True


def subir_fraccionados(fraccionados: dict[str, str]) -> None:
    drive = obtener_servicio_drive()
    creados, actualizados = 0, 0
    total = len(fraccionados)
    for i, (fecha_iso, contenido_txt) in enumerate(sorted(fraccionados.items()), start=1):
        fecha_dt = datetime.strptime(fecha_iso, "%Y-%m-%d")
        carpeta_lyfta = resolver_ruta_diaria(fecha_dt, "01_LYFTA_RAW")
        dd_mm_yyyy = fecha_dt.strftime("%d_%m_%Y")
        nombre = f"HISTORICO_LYFTA_{dd_mm_yyyy}.txt"
        _, was_created = _upsert_archivo_en_carpeta(
            drive,
            carpeta_lyfta,
            nombre,
            contenido_txt.encode("utf-8"),
            "text/plain",
        )
        if was_created:
            creados += 1
        else:
            actualizados += 1
        if i % 10 == 0 or i == total or i == 1:
            print(f"  [{i}/{total}] {fecha_iso} -> {nombre}", flush=True)
    print(
        f"[OK] Fraccionado completo. Creados={creados} · Actualizados={actualizados}",
        flush=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--csv",
        default=str(BASE_DIR / "RUTINA" / "ENTRENOS_ALVARO_GOMEZ_RUIZ.csv"),
        help="Ruta al CSV histórico (default: RUTINA/ENTRENOS_ALVARO_GOMEZ_RUIZ.csv)",
    )
    parser.add_argument(
        "--regenerar-perfil",
        action="store_true",
        help="Llama a DeepSeek-Pro para regenerar PERFIL_ATLETA.md tras subir CSV/RUTINA.",
    )
    parser.add_argument(
        "--skip-fraccionar",
        action="store_true",
        help="No fracciona el CSV (úsalo si solo quieres subir el agregado).",
    )
    args = parser.parse_args()

    ruta_csv = Path(args.csv)
    if not ruta_csv.exists():
        sys.exit(f"[ERROR] CSV no encontrado en {ruta_csv}")
    print(f"[1/4] CSV detectado: {ruta_csv} ({ruta_csv.stat().st_size:,} bytes)", flush=True)

    print("[2/4] Subiendo CSV agregado a 00_CONTEXTO_HISTORICO/...", flush=True)
    fid_csv = subir_csv_contexto(str(ruta_csv))
    print(f"      OK file_id={fid_csv}", flush=True)

    md_rutina = BASE_DIR / "RUTINA_OFICIAL.md"
    if md_rutina.exists():
        print("      Subiendo RUTINA_OFICIAL.md...", flush=True)
        fid_rut = guardar_rutina_oficial(md_rutina.read_text(encoding="utf-8"))
        print(f"      OK file_id={fid_rut}", flush=True)
    else:
        print("      [WARN] RUTINA_OFICIAL.md no encontrado en raíz. Salto.", flush=True)

    if not args.skip_fraccionar:
        print("[3/4] Fraccionando CSV por días...", flush=True)
        fraccionados = fraccionar_csv_por_dias(ruta_csv)
        print(f"      Sesiones detectadas: {len(fraccionados)}", flush=True)
        subir_fraccionados(fraccionados)
    else:
        print("[3/4] Salto fraccionamiento (--skip-fraccionar).", flush=True)

    if args.regenerar_perfil:
        if not os.environ.get("DEEPSEEK_API_KEY"):
            sys.exit("[ERROR] DEEPSEEK_API_KEY no en .env, no puedo regenerar perfil.")
        print("[4/4] Regenerando PERFIL_ATLETA.md con DeepSeek-Pro...", flush=True)
        ok = generar_perfil_atleta_desde_csv()
        print(f"      [{'OK' if ok else 'FALLO'}] PERFIL_ATLETA.md", flush=True)
    else:
        print("[4/4] Salto regeneración de perfil (sin --regenerar-perfil).", flush=True)


if __name__ == "__main__":
    main()
