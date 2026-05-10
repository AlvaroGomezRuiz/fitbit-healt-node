import io
import os
import json
from datetime import datetime
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

# CONFIGURACIÓN MAESTRA
TOKEN_PATH = "token.json"
FOLDER_SALUD_ID = "1s2GSGjlxChGy39jUxJFDiijBCWKKg-T5" # ID de tu carpeta raíz "Salud"

# Diccionario para forzar el formato de tus carpetas (05_MAYO, etc.)
MESES = {
    1: "01_ENERO", 2: "02_FEBRERO", 3: "03_MARZO", 4: "04_ABRIL",
    5: "05_MAYO", 6: "06_JUNIO", 7: "07_JULIO", 8: "08_AGOSTO",
    9: "09_SEPTIEMBRE", 10: "10_OCTUBRE", 11: "11_NOVIEMBRE", 12: "12_DICIEMBRE"
}

def obtener_servicio_drive():
    """Autenticación híbrida: Entorno Cloud o Local."""
    token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
    if token_env:
        creds = Credentials.from_authorized_user_info(json.loads(token_env))
    else:
        if not os.path.exists(TOKEN_PATH):
            raise FileNotFoundError(f"Falta {TOKEN_PATH} para ejecución local.")
        creds = Credentials.from_authorized_user_file(TOKEN_PATH)
    return build('drive', 'v3', credentials=creds)

def obtener_o_crear(nombre, parent_id, drive_service, es_carpeta=True):
    """Busca un recurso por nombre o lo crea si no existe."""
    query = f"name='{nombre}' and '{parent_id}' in parents and trashed=false"
    if es_carpeta:
        query += " and mimeType='application/vnd.google-apps.folder'"

    res = drive_service.files().list(q=query, fields='files(id)').execute()
    archivos = res.get('files', [])

    if archivos:
        return archivos[0]['id']

    meta = {'name': nombre, 'parents': [parent_id]}
    if es_carpeta:
        meta['mimeType'] = 'application/vnd.google-apps.folder'

    nuevo = drive_service.files().create(body=meta, fields='id').execute()
    return nuevo.get('id')

def resolver_ruta_inteligente(fecha_dt, sub_nombre):
    """
    Navega la jerarquía: Salud > Año > 05_MAYO > 10_05_2026 > Subcarpeta
    """
    drive_service = obtener_servicio_drive()

    anio_str = str(fecha_dt.year)
    mes_str = MESES[fecha_dt.month]
    dia_str = fecha_dt.strftime('%d_%m_%Y')

    # Navegación profunda
    id_anio = obtener_o_crear(anio_str, FOLDER_SALUD_ID, drive_service)
    id_mes = obtener_o_crear(mes_str, id_anio, drive_service)
    id_dia = obtener_o_crear(dia_str, id_mes, drive_service)

    return obtener_o_crear(sub_nombre, id_dia, drive_service)

def volcar_archivo_raw(content, extension, fecha_dt):
    """Guarda el archivo original en 01_LYFTA_RAW dentro de su día correspondiente."""
    drive_service = obtener_servicio_drive()
    id_destino = resolver_ruta_inteligente(fecha_dt, "01_LYFTA_RAW")

    mimetypes = {
        "pdf": "application/pdf",
        "json": "application/json",
        "csv": "text/csv",
        "txt": "text/plain"
    }

    # Manejo de contenido (Texto vs Binario)
    if isinstance(content, str):
        file_io = io.BytesIO(content.encode('utf-8'))
    else:
        file_io = io.BytesIO(content)

    media = MediaIoBaseUpload(
        file_io,
        mimetype=mimetypes.get(extension, "text/plain"),
        resumable=True
    )

    nombre = f"ENTRENO_{fecha_dt.strftime('%H%M')}.{extension}"
    drive_service.files().create(
        body={'name': nombre, 'parents': [id_destino]},
        media_body=media
    ).execute()

def volcar_log_sistema(log_text, nombre_archivo, fecha_dt=None):
    """Guarda logs técnicos en 03_MOTOR_V15_LOGS."""
    if not fecha_dt: fecha_dt = datetime.now()
    drive_service = obtener_servicio_drive()
    id_destino = resolver_ruta_inteligente(fecha_dt, "03_MOTOR_V15_LOGS")

    media = MediaIoBaseUpload(
        io.BytesIO(log_text.encode('utf-8')),
        mimetype='text/plain',
        resumable=True
    )
    drive_service.files().create(
        body={'name': nombre_archivo, 'parents': [id_destino]},
        media_body=media
    ).execute()

def actualizar_memoria_lineal(nuevo_registro_texto):
    """Actualiza el archivo HISTORIAL_V15_YYYY_MM.md central."""
    drive_service = obtener_servicio_drive()
    mes_actual = datetime.now().strftime('%Y_%m')
    nombre_archivo = f"HISTORIAL_V15_{mes_actual}.md"

    query = f"name='{nombre_archivo}' and '{FOLDER_SALUD_ID}' in parents and trashed=false"
    res = drive_service.files().list(q=query, fields='files(id)').execute()
    archivos = res.get('files', [])

    historial_previo = ""
    file_id = None

    if archivos:
        file_id = archivos[0]['id']
        request = drive_service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        historial_previo = fh.getvalue().decode('utf-8')

    timestamp = datetime.now().isoformat()
    nuevo_contenido = historial_previo + f"\n[{timestamp}] {nuevo_registro_texto}"
    media = MediaIoBaseUpload(io.BytesIO(nuevo_contenido.encode('utf-8')), mimetype='text/markdown')

    if file_id:
        drive_service.files().update(fileId=file_id, media_body=media).execute()
    else:
        drive_service.files().create(body={'name': nombre_archivo, 'parents': [FOLDER_SALUD_ID]}, media_body=media).execute()

def descargar_memoria_lineal():
    """Descarga el log mensual para inyectarlo en el cerebro de la IA."""
    drive_service = obtener_servicio_drive()
    mes_actual = datetime.now().strftime('%Y_%m')
    nombre_archivo = f"HISTORIAL_V15_{mes_actual}.md"

    query = f"name='{nombre_archivo}' and '{FOLDER_SALUD_ID}' in parents and trashed=false"
    res = drive_service.files().list(q=query, fields='files(id)').execute()
    archivos = res.get('files', [])

    if not archivos: return "No hay historial previo registrado."

    file_id = archivos[0]['id']
    request = drive_service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return fh.getvalue().decode('utf-8')

def leer_estado_maestro(file_id):
    """Carga el estado biológico (Digital Twin)."""
    drive_service = obtener_servicio_drive()
    request = drive_service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return json.loads(fh.getvalue().decode('utf-8'))

def actualizar_estado_maestro(file_id, nuevo_estado_json):
    """Actualiza el estado biológico en Drive."""
    drive_service = obtener_servicio_drive()
    media = MediaIoBaseUpload(io.BytesIO(json.dumps(nuevo_estado_json, indent=2).encode('utf-8')), mimetype='application/json')
    drive_service.files().update(fileId=file_id, media_body=media).execute()
