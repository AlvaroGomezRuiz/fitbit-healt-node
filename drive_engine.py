import io
import os
import json
from datetime import datetime
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

# CONFIGURACIÓN MAESTRA V15
TOKEN_PATH = "token.json"
FOLDER_SALUD_ID = "1s2GSGjlxChGy39jUxJFDiijBCWKKg-T5"

MESES = {
    1: "01_ENERO", 2: "02_FEBRERO", 3: "03_MARZO", 4: "04_ABRIL",
    5: "05_MAYO", 6: "06_JUNIO", 7: "07_JULIO", 8: "08_AGOSTO",
    9: "09_SEPTIEMBRE", 10: "10_OCTUBRE", 11: "11_NOVIEMBRE", 12: "12_DICIEMBRE"
}

def obtener_servicio_drive():
    token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
    if token_env:
        creds = Credentials.from_authorized_user_info(json.loads(token_env))
    else:
        creds = Credentials.from_authorized_user_file(TOKEN_PATH)
    return build('drive', 'v3', credentials=creds)

def obtener_o_crear(nombre, parent_id, drive_service, es_carpeta=True):
    query = f"name='{nombre}' and '{parent_id}' in parents and trashed=false"
    if es_carpeta: query += " and mimeType='application/vnd.google-apps.folder'"

    res = drive_service.files().list(q=query, fields='files(id)').execute()
    archivos = res.get('files', [])
    if archivos: return archivos[0]['id']

    meta = {'name': nombre, 'parents': [parent_id]}
    if es_carpeta: meta['mimeType'] = 'application/vnd.google-apps.folder'
    return drive_service.files().create(body=meta, fields='id').execute().get('id')

def resolver_ruta_inteligente(fecha_dt, sub_nombre):
    drive_service = obtener_servicio_drive()
    id_anio = obtener_o_crear(str(fecha_dt.year), FOLDER_SALUD_ID, drive_service)
    id_mes = obtener_o_crear(MESES[fecha_dt.month], id_anio, drive_service)
    id_dia = obtener_o_crear(fecha_dt.strftime('%d_%m_%Y'), id_mes, drive_service)
    return obtener_o_crear(sub_nombre, id_dia, drive_service)

def volcar_archivo_raw(content, extension, fecha_dt, tipo_rutina):
    drive_service = obtener_servicio_drive()
    id_destino = resolver_ruta_inteligente(fecha_dt, "01_LYFTA_RAW")
    nombre_final = f"{tipo_rutina.upper()}_{fecha_dt.strftime('%d_%m_%Y')}.{extension}"

    mimetypes = {"pdf": "application/pdf", "csv": "text/csv", "txt": "text/plain"}
    file_io = io.BytesIO(content.encode('utf-8') if isinstance(content, str) else content)
    media = MediaIoBaseUpload(file_io, mimetype=mimetypes.get(extension, "text/plain"), resumable=True)
    drive_service.files().create(body={'name': nombre_final, 'parents': [id_destino]}, media_body=media).execute()

def volcar_log_sistema(log_text: str, nombre_archivo: str, fecha_dt=None):
    """Guarda errores y eventos técnicos."""
    if not fecha_dt: fecha_dt = datetime.now()
    drive_service = obtener_servicio_drive()
    id_destino = resolver_ruta_inteligente(fecha_dt, "03_MOTOR_V15_LOGS")
    media = MediaIoBaseUpload(io.BytesIO(log_text.encode('utf-8')), mimetype='text/plain', resumable=True)
    drive_service.files().create(body={'name': nombre_archivo, 'parents': [id_destino]}, media_body=media).execute()

def actualizar_memoria_lineal(nuevo_registro_texto):
    drive_service = obtener_servicio_drive()
    nombre_archivo = f"HISTORIAL_V15_{datetime.now().strftime('%Y_%m')}.md"
    query = f"name='{nombre_archivo}' and '{FOLDER_SALUD_ID}' in parents and trashed=false"
    res = drive_service.files().list(q=query, fields='files(id)').execute()
    archivos = res.get('files', [])

    historial_previo, file_id = "", None
    if archivos:
        file_id = archivos[0]['id']
        request = drive_service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done: _, done = downloader.next_chunk()
        historial_previo = fh.getvalue().decode('utf-8')

    nuevo_contenido = historial_previo + f"\n[{datetime.now().isoformat()}] {nuevo_registro_texto}"
    media = MediaIoBaseUpload(io.BytesIO(nuevo_contenido.encode('utf-8')), mimetype='text/markdown')

    if file_id:
        drive_service.files().update(fileId=file_id, media_body=media).execute()
    else:
        drive_service.files().create(body={'name': nombre_archivo, 'parents': [FOLDER_SALUD_ID]}, media_body=media).execute()

def descargar_memoria_lineal():
    drive_service = obtener_servicio_drive()
    nombre_archivo = f"HISTORIAL_V15_{datetime.now().strftime('%Y_%m')}.md"
    query = f"name='{nombre_archivo}' and '{FOLDER_SALUD_ID}' in parents and trashed=false"
    res = drive_service.files().list(q=query, fields='files(id)').execute()
    archivos = res.get('files', [])
    if not archivos: return "Sin historial."
    request = drive_service.files().get_media(fileId=archivos[0]['id'])
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done: _, done = downloader.next_chunk()
    return fh.getvalue().decode('utf-8')

def leer_estado_maestro(file_id):
    drive_service = obtener_servicio_drive()
    request = drive_service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done: _, done = downloader.next_chunk()
    return json.loads(fh.getvalue().decode('utf-8'))

def actualizar_estado_maestro(file_id, nuevo_estado_json):
    drive_service = obtener_servicio_drive()
    media = MediaIoBaseUpload(io.BytesIO(json.dumps(nuevo_estado_json, indent=2).encode('utf-8')), mimetype='application/json')
    drive_service.files().update(fileId=file_id, media_body=media).execute()
