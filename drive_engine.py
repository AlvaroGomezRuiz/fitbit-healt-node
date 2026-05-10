from googleapiclient.discovery import build
from google.oauth2 import service_account
import json
import io
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

# La cuenta de servicio en Cloud Run se autentica automáticamente con el entorno
# ID de la carpeta SALUD (Debes extraerlo de la URL de tu navegador al abrir la carpeta)
FOLDER_SALUD_ID = "1s2GSGjlxChGy39jUxJFDiijBCWKKg-T5?hl=es-419"

def obtener_servicio_drive():
    return build('drive', 'v3')

def leer_estado_maestro(file_id):
    """Extrae el cerebro biométrico a la memoria del contenedor."""
    drive_service = obtener_servicio_drive()
    request = drive_service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    return json.loads(fh.getvalue().decode('utf-8'))

def actualizar_estado_maestro(file_id, nuevo_estado_json):
    """Reescribe el archivo maestro si se detectan adaptaciones (ej. pérdida de peso)."""
    drive_service = obtener_servicio_drive()
    media = MediaIoBaseUpload(
        io.BytesIO(json.dumps(nuevo_estado_json, indent=2).encode('utf-8')),
        mimetype='application/json',
        resumable=True
    )
    drive_service.files().update(
        fileId=file_id,
        media_body=media
    ).execute()
