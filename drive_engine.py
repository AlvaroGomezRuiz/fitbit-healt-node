from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
import json
import io
import locale
from datetime import datetime
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload
import os

# CONFIGURACIÓN MAESTRA DEL ECOSISTEMA
TOKEN_PATH = "token.json"
FOLDER_SALUD_ID = "1s2GSGjlxChGy39jUxJFDiijBCWKKg-T5"  # Tu Data Lake de 5TB

try:
    # Ajuste de idioma para que las carpetas de meses se creen en español
    locale.setlocale(locale.LC_TIME, 'es_ES.UTF-8')
except locale.Error:
    pass

def obtener_servicio_drive():
    """Autenticación Híbrida: RAM en Cloud Run, Archivo en Local."""
    token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
    if token_env:
        # Modo Producción: Extrae las llaves directamente de la memoria del servidor
        creds = Credentials.from_authorized_user_info(json.loads(token_env))
    else:
        # Modo Desarrollo: Usa el archivo token.json de tu carpeta local
        if not os.path.exists(TOKEN_PATH):
            raise FileNotFoundError(f"Falta {TOKEN_PATH} para ejecución local.")
        creds = Credentials.from_authorized_user_file(TOKEN_PATH)
    return build('drive', 'v3', credentials=creds)

def leer_estado_maestro(file_id):
    """Descarga el JSON maestro (tu estado biológico actual) a la memoria."""
    drive_service = obtener_servicio_drive()
    request = drive_service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    return json.loads(fh.getvalue().decode('utf-8'))

def actualizar_estado_maestro(file_id, nuevo_estado_json):
    """Sobreescribe el JSON maestro en Drive (Aprendizaje del Gemelo Digital)."""
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

def obtener_carpeta_por_nombre(nombre, parent_id, drive_service):
    """Busca un nodo (carpeta) específico para evitar duplicados."""
    query = f"mimeType='application/vnd.google-apps.folder' and name='{nombre}' and '{parent_id}' in parents and trashed=false"
    response = drive_service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    archivos = response.get('files', [])
    if archivos:
        return archivos[0].get('id')
    return None

def resolver_ruta_diaria_v15(drive_service):
    """Navega por la jerarquía Año > Mes > Día > 02_RESUMEN_DIARIO_IA."""
    ahora = datetime.now()
    anio = str(ahora.year)
    mes = f"{ahora.month:02d}_{ahora.strftime('%B').upper()}"
    dia = ahora.strftime('%d_%m_%Y')

    # Descenso por el árbol de carpetas
    id_anio = obtener_carpeta_por_nombre(anio, FOLDER_SALUD_ID, drive_service)
    id_mes = obtener_carpeta_por_nombre(mes, id_anio, drive_service)
    id_dia = obtener_carpeta_por_nombre(dia, id_mes, drive_service)

    # Destino final para los informes que leerá Gemini
    id_destino = obtener_carpeta_por_nombre("02_RESUMEN_DIARIO_IA", id_dia, drive_service)

    return id_destino

def volcar_json_diario(datos_dict, nombre_archivo):
    """Guarda el diagnóstico del día en su carpeta correspondiente."""
    drive_service = obtener_servicio_drive()
    id_carpeta_destino = resolver_ruta_diaria_v15(drive_service)

    if not id_carpeta_destino:
        raise Exception("Error: No se encontró la carpeta del día. Ejecuta el script de creación de carpetas.")

    media = MediaIoBaseUpload(
        io.BytesIO(json.dumps(datos_dict, indent=2).encode('utf-8')),
        mimetype='application/json',
        resumable=True
    )
    metadata_archivo = {
        'name': nombre_archivo,
        'parents': [id_carpeta_destino]
    }

    archivo = drive_service.files().create(
        body=metadata_archivo,
        media_body=media,
        fields='id'
    ).execute()

    return archivo.get('id')
