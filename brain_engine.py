import os
import json
import time
import io
from datetime import datetime
import requests
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

# Importaciones del motor de persistencia
from drive_engine import (
    leer_estado_maestro,
    actualizar_estado_maestro,
    descargar_memoria_lineal,
    actualizar_memoria_lineal,
    volcar_log_sistema,
    obtener_servicio_drive,
    resolver_ruta_inteligente
)

# CONFIGURACIÓN DE IDENTIDAD Y ACCESO MAESTRO (Exportados para health_node.py)
FILE_ID_MAESTRO = "1POEuCbmOEIURg7UycPsbIrH62uQvJgLI"
RUTINA_MAESTRA = "Lunes: PULL | Martes: PUSH | Miércoles: LEG | Jueves: PULL | Viernes: PUSH"
TOKEN_PATH = "token.json"

def ejecutar_peticion_rest(prompt, modelo_preferido="gemini-3.1-flash-lite"):
    """Inferencia con sistema de redundancia para evitar errores de cuota."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    modelos = [modelo_preferido, "gemini-3.1-flash-lite", "gemini-1.5-flash"]
    modelos = list(dict.fromkeys(modelos))

    for modelo in modelos:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2048}
        }
        try:
            resp = requests.post(url, json=payload, timeout=30)
            if resp.status_code == 200:
                return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            if resp.status_code == 429:
                continue
        except:
            continue
    return None

def salvar_reporte_en_drive(contenido, subcarpeta, prefijo):
    """Persistencia de reportes de IA."""
    try:
        drive_service = obtener_servicio_drive()
        id_destino = resolver_ruta_inteligente(datetime.now(), subcarpeta)
        nombre_archivo = f"{prefijo}_{datetime.now().strftime('%d_%m_%Y')}.md"
        media = MediaIoBaseUpload(io.BytesIO(contenido.encode('utf-8')), mimetype='text/markdown')
        drive_service.files().create(body={'name': nombre_archivo, 'parents': [id_destino]}, media_body=media).execute()
        return True
    except: return False

def generar_resumen_pre_entreno():
    """Genera el análisis de preparación de las 09:00 AM."""
    estado = leer_estado_maestro(FILE_ID_MAESTRO)
    historial = descargar_memoria_lineal()
    prompt = f"TASK: Readiness report. DATA: {json.dumps(estado)}. HISTORY: {historial[-2000:]}. SPANISH."
    report = ejecutar_peticion_rest(prompt, "gemini-3.1-pro-preview")
    if report:
        actualizar_memoria_lineal("[SYSTEM] Briefing matutino generado.")
        return salvar_reporte_en_drive(report, "02_RESUMEN_DIARIO_IA", "PRE_ENTRENO")
    return False

def extraer_metadatos_entreno(texto_crudo):
    """Extracción de metadatos con validación de tipo para evitar errores de None."""
    prompt = f"Extract JSON {{'fecha': 'YYYY-MM-DD', 'tipo': 'PUSH/PULL/LEG'}} from: {texto_crudo[:500]}"
    res = ejecutar_peticion_rest(prompt, "gemini-3.1-flash-lite")

    # VALIDACIÓN DE SEGURIDAD: Comprobar si res es None antes de usar .replace()
    if res is None:
        volcar_log_sistema("API_RESPONSE_NONE", "ERR_METADATA.txt")
        return datetime.now(), "ENTRENO"

    try:
        # Ahora es seguro usar .replace()
        clean_json = res.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_json)
        fecha_str = data.get('fecha', 'TODAY')
        fecha_dt = datetime.now() if fecha_str == "TODAY" else datetime.strptime(fecha_str, "%Y-%m-%d")
        return fecha_dt, data.get('tipo', 'ENTRENO').upper()
    except Exception as e:
        volcar_log_sistema(f"JSON_PARSE_ERROR: {str(e)}", "ERR_PARSE.txt")
        return datetime.now(), "ENTRENO"

def procesar_entrenamiento_llm(raw_text, estado_maestro, formato="txt"):
    """Auditoría biomecánica con manejo de errores de respuesta vacía."""
    prompt = f"Audit workout: {raw_text}. Context: {json.dumps(estado_maestro)}. SPANISH."
    res = ejecutar_peticion_rest(prompt, "gemini-3.1-flash-lite")

    # VALIDACIÓN DE SEGURIDAD
    if res is None:
        return "Error: El motor de análisis no devolvió datos."

    actualizar_memoria_lineal(f"\n### REPORTE POST-ENTRENO\n{res}")
    return res

def sincronizar_biometria_fit():
    """Sincronización de peso."""
    try:
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
        creds = Credentials.from_authorized_user_info(json.loads(token_env)) #type: ignore
        service = build('fitness', 'v1', credentials=creds)
        # ... (lógica de sincronización ya validada)
        return True
    except: return False
