"""
Motor de persistencia en Google Drive con jerarquía AÑO/MES/DÍA.

Estructura escrita:

    FOLDER_SALUD/
    ├── BIOMETRIA_MAESTRO.json                       (FILE_ID_MAESTRO, mutable)
    ├── 00_CONTEXTO_HISTORICO/
    │   ├── ENTRENOS_ALVARO_GOMEZ_RUIZ.csv
    │   └── PERFIL_ATLETA.md
    ├── 2026/
    │   ├── 05_MAYO/
    │   │   ├── 12_05_2026/
    │   │   │   ├── 01_LYFTA_RAW/
    │   │   │   ├── 02_RESUMEN_DIARIO_IA/
    │   │   │   ├── 03_MOTOR_IA_LOGS/
    │   │   │   └── 04_HEALTH_RAW/
    │   │   ├── HISTORICO_IA_MAYO_2026.txt
    │   │   └── DIARIO_ALVARO_MAYO_2026.html
    │   └── DIARIO_ALVARO_2026.html
    └── 2027/, 2028/, …

Retención: 04_HEALTH_RAW/*.json se purga a los 120 días por purgar_health_raw().
"""

from __future__ import annotations

import io
import json
import os
from datetime import datetime, timedelta

import pytz
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

from ..auth import obtener_credenciales_validas

MESES = {
    1: "01_ENERO", 2: "02_FEBRERO", 3: "03_MARZO", 4: "04_ABRIL",
    5: "05_MAYO", 6: "06_JUNIO", 7: "07_JULIO", 8: "08_AGOSTO",
    9: "09_SEPTIEMBRE", 10: "10_OCTUBRE", 11: "11_NOVIEMBRE", 12: "12_DICIEMBRE",
}
NOMBRES_MESES = {k: v.split("_", 1)[1] for k, v in MESES.items()}
ZONA_HORARIA = pytz.timezone("Europe/Madrid")

RETENCION_HEALTH_RAW_DIAS = 120


def _ahora() -> datetime:
    return datetime.now(ZONA_HORARIA)


def obtener_servicio_drive():
    creds = obtener_credenciales_validas()
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _escape(nombre: str) -> str:
    return nombre.replace("'", "\\'")


def obtener_o_crear(nombre: str, parent_id: str, drive=None, es_carpeta: bool = True) -> str:
    drive = drive or obtener_servicio_drive()
    q = (
        f"name='{_escape(nombre)}' and '{parent_id}' in parents and trashed=false"
    )
    if es_carpeta:
        q += " and mimeType='application/vnd.google-apps.folder'"

    res = drive.files().list(q=q, fields="files(id)").execute()
    archivos = res.get("files", [])
    if archivos:
        return archivos[0]["id"]

    meta = {"name": nombre, "parents": [parent_id]}
    if es_carpeta:
        meta["mimeType"] = "application/vnd.google-apps.folder"
    return drive.files().create(body=meta, fields="id").execute()["id"]


def _root_salud() -> str:
    folder = os.environ.get("FOLDER_SALUD_ID")
    if not folder:
        raise RuntimeError("FOLDER_SALUD_ID no inyectado en el entorno.")
    return folder


def resolver_ruta_diaria(fecha_dt: datetime, sub_nombre: str) -> str:
    """
    Enruta a SALUD → AÑO → MES → DÍA → SUB_CARPETA.
    Día con formato DD_MM_YYYY (ej. 12_05_2026) para coincidir con la estructura
    pre-creada del usuario en Drive.
    """
    drive = obtener_servicio_drive()
    id_anio = obtener_o_crear(str(fecha_dt.year), _root_salud(), drive)
    id_mes = obtener_o_crear(MESES[fecha_dt.month], id_anio, drive)
    id_dia = obtener_o_crear(fecha_dt.strftime("%d_%m_%Y"), id_mes, drive)
    return obtener_o_crear(sub_nombre, id_dia, drive)


def resolver_ruta_mes(fecha_dt: datetime) -> str:
    """Enruta a SALUD → AÑO → MES (raíz del mes, donde viven los HISTORICO_*/DIARIO_*)."""
    drive = obtener_servicio_drive()
    id_anio = obtener_o_crear(str(fecha_dt.year), _root_salud(), drive)
    return obtener_o_crear(MESES[fecha_dt.month], id_anio, drive)


def resolver_ruta_anio(fecha_dt: datetime) -> str:
    drive = obtener_servicio_drive()
    return obtener_o_crear(str(fecha_dt.year), _root_salud(), drive)


def resolver_ruta_contexto() -> str:
    """SALUD → 00_CONTEXTO_HISTORICO (constante, raíz)."""
    drive = obtener_servicio_drive()
    return obtener_o_crear("00_CONTEXTO_HISTORICO", _root_salud(), drive)


# ──────────────────────────────────────────────────────────────────────────
# ESCRITURA DE CONTENIDOS DEL DÍA
# ──────────────────────────────────────────────────────────────────────────

def volcar_archivo_raw(content: bytes | str, extension: str, fecha_dt: datetime, tipo_rutina: str) -> str:
    """Sube un archivo crudo (Lyfta TXT/PDF/CSV) a 01_LYFTA_RAW del día."""
    drive = obtener_servicio_drive()
    id_destino = resolver_ruta_diaria(fecha_dt, "01_LYFTA_RAW")
    nombre = f"{tipo_rutina.upper()}_{fecha_dt.strftime('%Y-%m-%d_%H%M')}.{extension}"
    mimetypes = {"pdf": "application/pdf", "csv": "text/csv", "txt": "text/plain"}
    buf = io.BytesIO(content.encode("utf-8") if isinstance(content, str) else content)
    media = MediaIoBaseUpload(buf, mimetype=mimetypes.get(extension, "text/plain"), resumable=True)
    res = drive.files().create(
        body={"name": nombre, "parents": [id_destino]}, media_body=media, fields="id"
    ).execute()
    return res["id"]


def volcar_health_raw(snapshot_json: dict, fecha_dt: datetime, etiqueta: str) -> str:
    """Sube el JSON crudo de los 31 data types a 04_HEALTH_RAW del día."""
    drive = obtener_servicio_drive()
    id_destino = resolver_ruta_diaria(fecha_dt, "04_HEALTH_RAW")
    nombre = f"snapshot_{etiqueta}_{fecha_dt.strftime('%Y-%m-%d_%H%M')}.json"
    buf = io.BytesIO(json.dumps(snapshot_json, indent=2, ensure_ascii=False).encode("utf-8"))
    media = MediaIoBaseUpload(buf, mimetype="application/json", resumable=True)
    res = drive.files().create(
        body={"name": nombre, "parents": [id_destino]}, media_body=media, fields="id"
    ).execute()
    return res["id"]


def volcar_log_sistema(log_text: str, nombre_archivo: str, fecha_dt: datetime | None = None) -> None:
    drive = obtener_servicio_drive()
    fecha_dt = fecha_dt or _ahora()
    id_destino = resolver_ruta_diaria(fecha_dt, "03_MOTOR_IA_LOGS")
    media = MediaIoBaseUpload(io.BytesIO(log_text.encode("utf-8")), mimetype="text/plain", resumable=True)
    drive.files().create(body={"name": nombre_archivo, "parents": [id_destino]}, media_body=media).execute()


def volcar_reporte_html(contenido_html: str, fecha_dt: datetime, prefijo: str) -> str:
    """Sube un HTML legible a 02_RESUMEN_DIARIO_IA del día (PRE/POST/NOCHE)."""
    drive = obtener_servicio_drive()
    id_destino = resolver_ruta_diaria(fecha_dt, "02_RESUMEN_DIARIO_IA")
    nombre = f"{prefijo}_{fecha_dt.strftime('%Y-%m-%d')}.html"
    buf = io.BytesIO(contenido_html.encode("utf-8"))
    media = MediaIoBaseUpload(buf, mimetype="text/html", resumable=True)
    res = drive.files().create(
        body={"name": nombre, "parents": [id_destino]}, media_body=media, fields="id"
    ).execute()
    return res["id"]


# ──────────────────────────────────────────────────────────────────────────
# MEMORIA LINEAL (IA) Y DIARIOS HUMANOS
# ──────────────────────────────────────────────────────────────────────────

def _leer_o_crear(nombre: str, parent_id: str, contenido_inicial: bytes, mimetype: str) -> tuple[str, bytes]:
    """Devuelve (file_id, contenido_actual_bytes). Crea con contenido inicial si no existe."""
    drive = obtener_servicio_drive()
    q = f"name='{_escape(nombre)}' and '{parent_id}' in parents and trashed=false"
    res = drive.files().list(q=q, fields="files(id)").execute()
    archivos = res.get("files", [])
    if archivos:
        fid = archivos[0]["id"]
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, drive.files().get_media(fileId=fid))
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return fid, fh.getvalue()

    media = MediaIoBaseUpload(io.BytesIO(contenido_inicial), mimetype=mimetype)
    res = drive.files().create(
        body={"name": nombre, "parents": [parent_id]}, media_body=media, fields="id"
    ).execute()
    return res["id"], contenido_inicial


def _sobrescribir(file_id: str, contenido: bytes, mimetype: str) -> None:
    drive = obtener_servicio_drive()
    media = MediaIoBaseUpload(io.BytesIO(contenido), mimetype=mimetype)
    drive.files().update(fileId=file_id, media_body=media).execute()


def actualizar_memoria_lineal(linea_ia_txt: str, bloque_html_humano: str | None = None) -> None:
    """
    DOBLE ESCRITURA:
      1) HISTORICO_IA_<MES>_<AÑO>.txt → la IA lee este al día siguiente
      2) DIARIO_ALVARO_<MES>_<AÑO>.html → tu vista mensual (si hay HTML)
      3) DIARIO_ALVARO_<AÑO>.html → tu vista anual acumulativa (si hay HTML)
    """
    ahora = _ahora()
    id_mes = resolver_ruta_mes(ahora)
    id_anio = resolver_ruta_anio(ahora)

    # 1. Histórico IA (TXT)
    nombre_ia = f"HISTORICO_IA_{NOMBRES_MESES[ahora.month]}_{ahora.year}.txt"
    fid_ia, prev = _leer_o_crear(
        nombre_ia, id_mes,
        contenido_inicial=f"# Histórico IA {NOMBRES_MESES[ahora.month]} {ahora.year}\n".encode("utf-8"),
        mimetype="text/plain",
    )
    nuevo = prev + f"\n[{ahora.isoformat()}] {linea_ia_txt}".encode("utf-8")
    _sobrescribir(fid_ia, nuevo, "text/plain")

    if not bloque_html_humano:
        return

    bloque = (
        f'<hr><h3>{ahora.strftime("%d/%m/%Y %H:%M")}</h3>'
        f"{bloque_html_humano}"
    ).encode("utf-8")

    # 2. Diario mensual humano
    nombre_mes = f"DIARIO_ALVARO_{NOMBRES_MESES[ahora.month]}_{ahora.year}.html"
    fid_mes, prev_mes = _leer_o_crear(
        nombre_mes, id_mes,
        contenido_inicial=(
            f"<!DOCTYPE html><meta charset='utf-8'>"
            f"<title>Diario {NOMBRES_MESES[ahora.month]} {ahora.year}</title>"
            f"<h1>Diario {NOMBRES_MESES[ahora.month]} {ahora.year}</h1>"
        ).encode("utf-8"),
        mimetype="text/html",
    )
    _sobrescribir(fid_mes, prev_mes + bloque, "text/html")

    # 3. Diario anual humano
    nombre_anio = f"DIARIO_ALVARO_{ahora.year}.html"
    fid_anio, prev_anio = _leer_o_crear(
        nombre_anio, id_anio,
        contenido_inicial=(
            f"<!DOCTYPE html><meta charset='utf-8'>"
            f"<title>Diario {ahora.year}</title>"
            f"<h1>Diario anual {ahora.year}</h1>"
        ).encode("utf-8"),
        mimetype="text/html",
    )
    _sobrescribir(fid_anio, prev_anio + bloque, "text/html")


def descargar_memoria_lineal(mes_offset: int = 0) -> str:
    """
    Devuelve el TXT del mes actual (offset 0) o de meses anteriores (offset positivo).
    """
    ahora = _ahora()
    objetivo = ahora
    for _ in range(mes_offset):
        primer_dia = objetivo.replace(day=1)
        objetivo = primer_dia - timedelta(days=1)

    id_mes = resolver_ruta_mes(objetivo)
    nombre = f"HISTORICO_IA_{NOMBRES_MESES[objetivo.month]}_{objetivo.year}.txt"

    drive = obtener_servicio_drive()
    q = f"name='{_escape(nombre)}' and '{id_mes}' in parents and trashed=false"
    res = drive.files().list(q=q, fields="files(id)").execute()
    archivos = res.get("files", [])
    if not archivos:
        return ""

    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, drive.files().get_media(fileId=archivos[0]["id"]))
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return fh.getvalue().decode("utf-8", errors="replace")


# ──────────────────────────────────────────────────────────────────────────
# JSON BIOMÉTRICO MAESTRO
# ──────────────────────────────────────────────────────────────────────────

def leer_estado_maestro(file_id: str) -> dict:
    drive = obtener_servicio_drive()
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, drive.files().get_media(fileId=file_id))
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return json.loads(fh.getvalue().decode("utf-8"))


def actualizar_estado_maestro(file_id: str, nuevo_estado: dict) -> None:
    drive = obtener_servicio_drive()
    media = MediaIoBaseUpload(
        io.BytesIO(json.dumps(nuevo_estado, indent=2, ensure_ascii=False).encode("utf-8")),
        mimetype="application/json",
    )
    drive.files().update(fileId=file_id, media_body=media).execute()


# ──────────────────────────────────────────────────────────────────────────
# CONTEXTO HISTÓRICO (CSV + PERFIL_ATLETA.md)
# ──────────────────────────────────────────────────────────────────────────

def subir_csv_contexto(ruta_local: str) -> str:
    """Sube el CSV de 148 entrenos a 00_CONTEXTO_HISTORICO/ si no existe."""
    drive = obtener_servicio_drive()
    id_ctx = resolver_ruta_contexto()
    nombre = os.path.basename(ruta_local)

    q = f"name='{_escape(nombre)}' and '{id_ctx}' in parents and trashed=false"
    res = drive.files().list(q=q, fields="files(id)").execute()
    if res.get("files"):
        return res["files"][0]["id"]

    with open(ruta_local, "rb") as fh:
        media = MediaIoBaseUpload(io.BytesIO(fh.read()), mimetype="text/csv", resumable=True)
    res = drive.files().create(
        body={"name": nombre, "parents": [id_ctx]}, media_body=media, fields="id"
    ).execute()
    return res["id"]


def descargar_csv_contexto() -> str:
    """Lee el CSV histórico desde 00_CONTEXTO_HISTORICO/ y devuelve texto."""
    drive = obtener_servicio_drive()
    id_ctx = resolver_ruta_contexto()
    q = f"name contains 'ENTRENOS' and '{id_ctx}' in parents and trashed=false"
    res = drive.files().list(q=q, fields="files(id,name)").execute()
    archivos = res.get("files", [])
    if not archivos:
        return ""
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, drive.files().get_media(fileId=archivos[0]["id"]))
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return fh.getvalue().decode("utf-8", errors="replace")


def guardar_perfil_atleta(markdown: str) -> str:
    drive = obtener_servicio_drive()
    id_ctx = resolver_ruta_contexto()
    nombre = "PERFIL_ATLETA.md"

    q = f"name='{nombre}' and '{id_ctx}' in parents and trashed=false"
    res = drive.files().list(q=q, fields="files(id)").execute()
    media = MediaIoBaseUpload(io.BytesIO(markdown.encode("utf-8")), mimetype="text/markdown")

    if res.get("files"):
        fid = res["files"][0]["id"]
        drive.files().update(fileId=fid, media_body=media).execute()
        return fid
    return drive.files().create(
        body={"name": nombre, "parents": [id_ctx]}, media_body=media, fields="id"
    ).execute()["id"]


def leer_perfil_atleta() -> str:
    drive = obtener_servicio_drive()
    id_ctx = resolver_ruta_contexto()
    q = f"name='PERFIL_ATLETA.md' and '{id_ctx}' in parents and trashed=false"
    res = drive.files().list(q=q, fields="files(id)").execute()
    archivos = res.get("files", [])
    if not archivos:
        return ""
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, drive.files().get_media(fileId=archivos[0]["id"]))
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return fh.getvalue().decode("utf-8", errors="replace")


# ──────────────────────────────────────────────────────────────────────────
# RETENCIÓN: PURGA AUTOMÁTICA DE 04_HEALTH_RAW > 120 DÍAS
# ──────────────────────────────────────────────────────────────────────────

def purgar_health_raw_antiguos() -> int:
    """
    Borra archivos en cualquier 04_HEALTH_RAW/ con createdTime > 120 días.
    Devuelve número de archivos eliminados.
    """
    drive = obtener_servicio_drive()
    limite = (datetime.utcnow() - timedelta(days=RETENCION_HEALTH_RAW_DIAS)).strftime(
        "%Y-%m-%dT%H:%M:%S"
    )
    q = (
        f"name='04_HEALTH_RAW' and mimeType='application/vnd.google-apps.folder' "
        f"and trashed=false"
    )
    carpetas = drive.files().list(q=q, fields="files(id)", pageSize=1000).execute().get("files", [])

    borrados = 0
    for carpeta in carpetas:
        cid = carpeta["id"]
        q_files = (
            f"'{cid}' in parents and trashed=false and createdTime < '{limite}'"
        )
        page_token = None
        while True:
            params = {"q": q_files, "fields": "nextPageToken, files(id)", "pageSize": 1000}
            if page_token:
                params["pageToken"] = page_token
            res = drive.files().list(**params).execute()
            for f in res.get("files", []):
                drive.files().delete(fileId=f["id"]).execute()
                borrados += 1
            page_token = res.get("nextPageToken")
            if not page_token:
                break
    return borrados
