import io
import os
import json
from datetime import datetime
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

# CONFIGURACIÓN MAESTRA
TOKEN_PATH = "token.json"
FOLDER_SALUD_ID = "1s2GSGjlxChGy39jUxJFDiijBCWKKg-T5"

MESES = {
    1: "01_ENERO", 2: "02_FEBRERO", 3: "03_MARZO", 4: "04_ABRIL",
    5: "05_MAYO", 6: "06_JUNIO", 7: "07_JULIO", 8: "08_AGOSTO",
    9: "09_SEPTIEMBRE", 10: "10_OCTUBRE", 11: "11_NOVIEMBRE", 12: "12_DICIEMBRE"
}

NOMBRES_MESES = {
    1: "ENERO", 2: "FEBRERO", 3: "MARZO", 4: "ABRIL",
    5: "MAYO", 6: "JUNIO", 7: "JULIO", 8: "AGOSTO",
    9: "SEPTIEMBRE", 10: "OCTUBRE", 11: "NOVIEMBRE", 12: "DICIEMBRE"
}

def obtener_servicio_drive():
    """Instancia el cliente de la API de Drive utilizando el token inyectado en el entorno."""
    token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
    if token_env:
        creds = Credentials.from_authorized_user_info(json.loads(token_env))
    else:
        creds = Credentials.from_authorized_user_file(TOKEN_PATH)
    return build('drive', 'v3', credentials=creds)

def obtener_o_crear(nombre, parent_id, drive_service, es_carpeta=True):
    """Garantiza la existencia de un nodo en el sistema de archivos de Drive."""
    query = f"name='{nombre}' and '{parent_id}' in parents and trashed=false"
    if es_carpeta: query += " and mimeType='application/vnd.google-apps.folder'"

    res = drive_service.files().list(q=query, fields='files(id)').execute()
    archivos = res.get('files', [])
    if archivos: return archivos[0]['id']

    meta = {'name': nombre, 'parents': [parent_id]}
    if es_carpeta: meta['mimeType'] = 'application/vnd.google-apps.folder'
    return drive_service.files().create(body=meta, fields='id').execute().get('id')

def resolver_ruta_inteligente(fecha_dt, sub_nombre):
    """Genera y resuelve la jerarquía temporal: Salud > Año > Mes > Día > Subdirectorio."""
    drive_service = obtener_servicio_drive()
    id_anio = obtener_o_crear(str(fecha_dt.year), FOLDER_SALUD_ID, drive_service)
    id_mes = obtener_o_crear(MESES[fecha_dt.month], id_anio, drive_service)
    id_dia = obtener_o_crear(fecha_dt.strftime('%d_%m_%Y'), id_mes, drive_service)
    return obtener_o_crear(sub_nombre, id_dia, drive_service)

def volcar_archivo_raw(content, extension, fecha_dt, tipo_rutina):
    """Almacena el reporte original (PDF/TXT) en la carpeta de entrada cruda (01_LYFTA_RAW)."""
    drive_service = obtener_servicio_drive()
    id_destino = resolver_ruta_inteligente(fecha_dt, "01_LYFTA_RAW")
    nombre_final = f"{tipo_rutina.upper()}_{fecha_dt.strftime('%d_%m_%Y')}.{extension}"

    mimetypes = {"pdf": "application/pdf", "csv": "text/csv", "txt": "text/plain"}
    file_io = io.BytesIO(content.encode('utf-8') if isinstance(content, str) else content)
    media = MediaIoBaseUpload(file_io, mimetype=mimetypes.get(extension, "text/plain"), resumable=True)
    drive_service.files().create(body={'name': nombre_final, 'parents': [id_destino]}, media_body=media).execute()

def volcar_log_sistema(log_text: str, nombre_archivo: str, fecha_dt=None):
    """Registro persistente de telemetría y errores para depuración asíncrona."""
    if not fecha_dt: fecha_dt = datetime.now()
    drive_service = obtener_servicio_drive()
    id_destino = resolver_ruta_inteligente(fecha_dt, "03_MOTOR_LOGS")
    media = MediaIoBaseUpload(io.BytesIO(log_text.encode('utf-8')), mimetype='text/plain', resumable=True)
    drive_service.files().create(body={'name': nombre_archivo, 'parents': [id_destino]}, media_body=media).execute()

def actualizar_memoria_lineal(nuevo_registro_texto):
    """Mantiene el log histórico acumulativo en formato TXT dentro de la carpeta del mes."""
    drive_service = obtener_servicio_drive()
    ahora = datetime.now()

    nombre_archivo = f"HISTORICO_{NOMBRES_MESES[ahora.month]}_{ahora.year}.txt"

    id_anio = obtener_o_crear(str(ahora.year), FOLDER_SALUD_ID, drive_service)
    id_mes = obtener_o_crear(MESES[ahora.month], id_anio, drive_service)

    query = f"name='{nombre_archivo}' and '{id_mes}' in parents and trashed=false"
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

    nuevo_contenido = historial_previo + f"\n[{ahora.isoformat()}] {nuevo_registro_texto}"
    media = MediaIoBaseUpload(io.BytesIO(nuevo_contenido.encode('utf-8')), mimetype='text/plain')

    if file_id:
        drive_service.files().update(fileId=file_id, media_body=media).execute()
    else:
        drive_service.files().create(body={'name': nombre_archivo, 'parents': [id_mes]}, media_body=media).execute()

def descargar_memoria_lineal():
    """Recupera el historial completo del mes actual para inyección de contexto en la IA."""
    drive_service = obtener_servicio_drive()
    ahora = datetime.now()

    nombre_archivo = f"HISTORICO_{NOMBRES_MESES[ahora.month]}_{ahora.year}.txt"

    id_anio = obtener_o_crear(str(ahora.year), FOLDER_SALUD_ID, drive_service)
    id_mes = obtener_o_crear(MESES[ahora.month], id_anio, drive_service)

    query = f"name='{nombre_archivo}' and '{id_mes}' in parents and trashed=false"
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
    """Extrae el JSON de estado (biometría y objetivos) para la toma de decisiones del motor."""
    drive_service = obtener_servicio_drive()
    request = drive_service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done: _, done = downloader.next_chunk()
    return json.loads(fh.getvalue().decode('utf-8'))

def actualizar_estado_maestro(file_id, nuevo_estado_json):
    """Persiste los cambios en el perfil biológico del usuario (peso, marcas personales)."""
    drive_service = obtener_servicio_drive()
    media = MediaIoBaseUpload(io.BytesIO(json.dumps(nuevo_estado_json, indent=2).encode('utf-8')), mimetype='application/json')
    drive_service.files().update(fileId=file_id, media_body=media).execute()
