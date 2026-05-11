import io
import os
import json
from datetime import datetime
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload


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
    token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
    if not token_env:
        raise RuntimeError("FALLO CRÍTICO: GOOGLE_OAUTH_TOKEN_JSON no inyectado en el entorno de Cloud Run.")

    creds = Credentials.from_authorized_user_info(json.loads(token_env))
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

def resolver_ruta_diaria(fecha_dt, sub_nombre):
    """Enruta a SALUD -> AÑO -> MES -> SUB_CARPETA (Ej. 01_LYFTA_RAW)"""
    folder_salud_id = os.environ["FOLDER_SALUD_ID"]
    drive_service = obtener_servicio_drive()
    id_anio = obtener_o_crear(str(fecha_dt.year), folder_salud_id, drive_service)
    id_mes = obtener_o_crear(MESES[fecha_dt.month], id_anio, drive_service)
    return obtener_o_crear(sub_nombre, id_mes, drive_service)

def resolver_ruta_historico(fecha_dt):
    """Enruta a SALUD -> AÑO -> HISTORICO -> MES"""
    folder_salud_id = os.environ["FOLDER_SALUD_ID"]
    drive_service = obtener_servicio_drive()
    id_anio = obtener_o_crear(str(fecha_dt.year), folder_salud_id, drive_service)
    id_historico = obtener_o_crear("HISTORICO", id_anio, drive_service)
    id_mes_historico = obtener_o_crear(MESES[fecha_dt.month], id_historico, drive_service)
    return id_mes_historico

def volcar_archivo_raw(content, extension, fecha_dt, tipo_rutina):
    drive_service = obtener_servicio_drive()
    id_destino = resolver_ruta_diaria(fecha_dt, "01_LYFTA_RAW")
    nombre_final = f"{tipo_rutina.upper()}_{fecha_dt.strftime('%d_%m_%Y')}.{extension}"
    mimetypes = {"pdf": "application/pdf", "csv": "text/csv", "txt": "text/plain"}
    file_io = io.BytesIO(content.encode('utf-8') if isinstance(content, str) else content)
    media = MediaIoBaseUpload(file_io, mimetype=mimetypes.get(extension, "text/plain"), resumable=True)
    drive_service.files().create(body={'name': nombre_final, 'parents': [id_destino]}, media_body=media).execute()

def volcar_log_sistema(log_text: str, nombre_archivo: str, fecha_dt=None):
    if not fecha_dt: fecha_dt = datetime.now()
    drive_service = obtener_servicio_drive()
    id_destino = resolver_ruta_diaria(fecha_dt, "03_MOTOR_IA_LOGS")
    media = MediaIoBaseUpload(io.BytesIO(log_text.encode('utf-8')), mimetype='text/plain', resumable=True)
    drive_service.files().create(body={'name': nombre_archivo, 'parents': [id_destino]}, media_body=media).execute()

def actualizar_memoria_lineal(nuevo_registro_texto, nuevo_registro_html=None):
    """
    SISTEMA DE DOBLE ESCRITURA:
    1. Escribe en HISTORICO_IA en .txt (para que la IA lo lea luego).
    2. Si hay HTML, actualiza DIARIO_ALVARO en Google Docs (para que tú lo leas).
    """
    drive_service = obtener_servicio_drive()
    ahora = datetime.now()
    id_destino = resolver_ruta_historico(ahora)

    # -----------------------------------------------------
    # CAPA 1: ACTUALIZACIÓN DEL CEREBRO DE LA IA (TXT)
    # -----------------------------------------------------
    nombre_ia = f"HISTORICO_IA_{NOMBRES_MESES[ahora.month]}_{ahora.year}.txt"
    query_ia = f"name='{nombre_ia}' and '{id_destino}' in parents and trashed=false"
    res_ia = drive_service.files().list(q=query_ia, fields='files(id)').execute()
    archivos_ia = res_ia.get('files', [])

    historial_previo = ""
    file_id_ia = None
    if archivos_ia:
        file_id_ia = archivos_ia[0]['id']
        request = drive_service.files().get_media(fileId=file_id_ia)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done: _, done = downloader.next_chunk()
        historial_previo = fh.getvalue().decode('utf-8')

    nuevo_contenido_txt = historial_previo + f"\n[{ahora.isoformat()}] {nuevo_registro_texto}"
    media_ia = MediaIoBaseUpload(io.BytesIO(nuevo_contenido_txt.encode('utf-8')), mimetype='text/plain')

    if file_id_ia:
        drive_service.files().update(fileId=file_id_ia, media_body=media_ia).execute()
    else:
        drive_service.files().create(body={'name': nombre_ia, 'parents': [id_destino]}, media_body=media_ia).execute()

    # -----------------------------------------------------
    # CAPA 2: ACTUALIZACIÓN DE TU DIARIO VISUAL (GOOGLE DOC)
    # -----------------------------------------------------
    if nuevo_registro_html:
        nombre_alvaro = f"DIARIO_ALVARO_{NOMBRES_MESES[ahora.month]}_{ahora.year}"

        # Guardamos un archivo puente en HTML invisible para no perder el formato acumulado
        nombre_puente = f"._{nombre_alvaro}.html"
        query_puente = f"name='{nombre_puente}' and '{id_destino}' in parents and trashed=false"
        res_puente = drive_service.files().list(q=query_puente, fields='files(id)').execute()

        historial_html_previo = "<h1>Diario de Rendimiento</h1>"
        file_id_puente = None
        if res_puente.get('files', []):
            file_id_puente = res_puente['files'][0]['id']
            request = drive_service.files().get_media(fileId=file_id_puente)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done: _, done = downloader.next_chunk()
            historial_html_previo = fh.getvalue().decode('utf-8')

        # Acumulamos el nuevo HTML
        nuevo_contenido_html = historial_html_previo + f"<hr><p><b>{ahora.strftime('%d/%m/%Y %H:%M')}</b></p>" + nuevo_registro_html

        # Subimos el puente
        media_puente = MediaIoBaseUpload(io.BytesIO(nuevo_contenido_html.encode('utf-8')), mimetype='text/html')
        if file_id_puente:
            drive_service.files().update(fileId=file_id_puente, media_body=media_puente).execute()
        else:
            drive_service.files().create(body={'name': nombre_puente, 'parents': [id_destino]}, media_body=media_puente).execute()

        # Transcodificamos al Documento de Google visible
        query_doc = f"name='{nombre_alvaro}' and '{id_destino}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false"
        res_doc = drive_service.files().list(q=query_doc, fields='files(id)').execute()

        # Usamos el HTML acumulado para actualizar el Doc
        media_doc = MediaIoBaseUpload(io.BytesIO(nuevo_contenido_html.encode('utf-8')), mimetype='text/html')
        if res_doc.get('files', []):
            drive_service.files().update(fileId=res_doc['files'][0]['id'], media_body=media_doc).execute()
        else:
            meta_doc = {'name': nombre_alvaro, 'parents': [id_destino], 'mimeType': 'application/vnd.google-apps.document'}
            drive_service.files().create(body=meta_doc, media_body=media_doc).execute()

def descargar_memoria_lineal():
    """La IA SOLO lee su archivo TXT crudo para no alucinar."""
    drive_service = obtener_servicio_drive()
    ahora = datetime.now()
    id_destino = resolver_ruta_historico(ahora)

    nombre_ia = f"HISTORICO_IA_{NOMBRES_MESES[ahora.month]}_{ahora.year}.txt"
    query = f"name='{nombre_ia}' and '{id_destino}' in parents and trashed=false"
    res = drive_service.files().list(q=query, fields='files(id)').execute()
    archivos = res.get('files', [])

    if not archivos: return "Sin historial previo."

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
