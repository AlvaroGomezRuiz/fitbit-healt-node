import io
import os
import json
import locale
from datetime import datetime
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

# CONFIGURACIÓN MAESTRA DEL ECOSISTEMA V15
TOKEN_PATH = "token.json"
FOLDER_SALUD_ID = "1s2GSGjlxChGy39jUxJFDiijBCWKKg-T5"

try:
    locale.setlocale(locale.LC_TIME, 'es_ES.UTF-8')
except locale.Error:
    pass

def obtener_servicio_drive():
    """Autenticación Híbrida: RAM en Cloud Run, Archivo en Local."""
    token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
    if token_env:
        creds = Credentials.from_authorized_user_info(json.loads(token_env))
    else:
        if not os.path.exists(TOKEN_PATH):
            raise FileNotFoundError(f"Falta {TOKEN_PATH} para ejecución local.")
        creds = Credentials.from_authorized_user_file(TOKEN_PATH)
    return build('drive', 'v3', credentials=creds)

# =====================================================================
# NUEVO SISTEMA: MEMORIA LINEAL PARA AGENTES (Inspirado en CLI-Health)
# =====================================================================

def actualizar_memoria_lineal(nuevo_registro_texto):
    """
    Añade una nueva línea al archivo HISTORIAL_MENSUAL.md en la raíz del Data Lake.
    Este archivo es el que Gemini leerá entero aprovechando su ventana de 2M de tokens.
    """
    drive_service = obtener_servicio_drive()
    mes_actual = datetime.now().strftime('%Y_%m')
    nombre_archivo = f"HISTORIAL_V15_{mes_actual}.md"

    query = f"name='{nombre_archivo}' and '{FOLDER_SALUD_ID}' in parents and trashed=false"
    response = drive_service.files().list(q=query, spaces='drive', fields='files(id)').execute()
    archivos = response.get('files', [])

    historial_previo = ""
    file_id = None

    if archivos:
        file_id = archivos[0].get('id')
        request = drive_service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        historial_previo = fh.getvalue().decode('utf-8')

    timestamp = datetime.now().isoformat()
    nuevo_contenido = historial_previo + f"\n[{timestamp}] {nuevo_registro_texto}"

    media = MediaIoBaseUpload(io.BytesIO(nuevo_contenido.encode('utf-8')), mimetype='text/markdown', resumable=True)

    if file_id:
        drive_service.files().update(fileId=file_id, media_body=media).execute()
    else:
        drive_service.files().create(body={'name': nombre_archivo, 'parents': [FOLDER_SALUD_ID]}, media_body=media).execute()

def descargar_memoria_lineal():
    """Descarga el log mensual en crudo para inyectarlo en el RAG de fuerza bruta."""
    drive_service = obtener_servicio_drive()
    mes_actual = datetime.now().strftime('%Y_%m')
    nombre_archivo = f"HISTORIAL_V15_{mes_actual}.md"

    query = f"name='{nombre_archivo}' and '{FOLDER_SALUD_ID}' in parents and trashed=false"
    response = drive_service.files().list(q=query, spaces='drive', fields='files(id)').execute()
    archivos = response.get('files', [])

    if not archivos:
        return "No hay historial previo registrado para este mes."

    file_id = archivos[0].get('id')
    request = drive_service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return fh.getvalue().decode('utf-8')

# =====================================================================
# SISTEMA LEGACY: ENRUTAMIENTO ESTRICTO (Para datos crudos y fallos)
# =====================================================================

def obtener_carpeta_existente(nombre, parent_id, drive_service):
    query = f"mimeType='application/vnd.google-apps.folder' and name='{nombre}' and '{parent_id}' in parents and trashed=false"
    response = drive_service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    archivos = response.get('files', [])
    if not archivos:
        raise NotADirectoryError(f"[CRÍTICO] Nodo ausente en Data Lake: '{nombre}'")
    return archivos[0].get('id')

def resolver_subcarpeta_diaria(drive_service, nombre_subcarpeta):
    ahora = datetime.now()
    anio = str(ahora.year)
    mes = f"{ahora.month:02d}_{ahora.strftime('%B').upper()}"
    dia = ahora.strftime('%d_%m_%Y')

    id_anio = obtener_carpeta_existente(anio, FOLDER_SALUD_ID, drive_service)
    id_mes = obtener_carpeta_existente(mes, id_anio, drive_service)
    id_dia = obtener_carpeta_existente(dia, id_mes, drive_service)
    return obtener_carpeta_existente(nombre_subcarpeta, id_dia, drive_service)

def volcar_entreno_lyfta(csv_content):
    drive_service = obtener_servicio_drive()
    id_carpeta_raw = resolver_subcarpeta_diaria(drive_service, "01_LYFTA_RAW")
    ahora = datetime.now()
    media = MediaIoBaseUpload(io.BytesIO(csv_content.encode('utf-8')), mimetype='text/csv', resumable=True)
    metadata = {'name': f"ENTRENO_LYFTA_{ahora.strftime('%H%M')}.csv", 'parents': [id_carpeta_raw]}
    return drive_service.files().create(body=metadata, media_body=media, fields='id').execute().get('id')

def volcar_log_sistema(log_text, nombre_archivo):
    drive_service = obtener_servicio_drive()
    id_carpeta_logs = resolver_subcarpeta_diaria(drive_service, "03_MOTOR_V15_LOGS")
    media = MediaIoBaseUpload(io.BytesIO(log_text.encode('utf-8')), mimetype='text/plain', resumable=True)
    metadata = {'name': nombre_archivo, 'parents': [id_carpeta_logs]}
    return drive_service.files().create(body=metadata, media_body=media, fields='id').execute().get('id')

# =====================================================================
# ESTADO MAESTRO (Tu Gemelo Digital)
# =====================================================================

def leer_estado_maestro(file_id):
    drive_service = obtener_servicio_drive()
    request = drive_service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return json.loads(fh.getvalue().decode('utf-8'))

def actualizar_estado_maestro(file_id, nuevo_estado_json):
    drive_service = obtener_servicio_drive()
    media = MediaIoBaseUpload(io.BytesIO(json.dumps(nuevo_estado_json, indent=2).encode('utf-8')), mimetype='application/json', resumable=True)
    drive_service.files().update(fileId=file_id, media_body=media).execute()
