import os
import json
import time
import io
from datetime import datetime
import requests
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

# Importaciones del motor de persistencia (drive_engine.py)
from drive_engine import (
    leer_estado_maestro,
    actualizar_estado_maestro,
    descargar_memoria_lineal,
    actualizar_memoria_lineal,
    volcar_log_sistema,
    obtener_servicio_drive,
    resolver_ruta_inteligente
)

# CONFIGURACIÓN DE IDENTIDAD Y ACCESO (Requeridos por health_node.py)
FILE_ID_MAESTRO = "1POEuCbmOEIURg7UycPsbIrH62uQvJgLI"
RUTINA_MAESTRA = "Lunes: PULL | Martes: PUSH | Miércoles: LEG | Jueves: PULL | Viernes: PUSH"
TOKEN_PATH = "token.json"

def ejecutar_peticion_rest(prompt, modelo_preferido="gemini-3.1-flash-lite"):
    """Inferencia con redundancia para evitar errores de cuota (429)."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    # Lista de modelos para fallback automático
    modelos = [modelo_preferido, "gemini-3.1-flash-lite", "gemini-1.5-flash"]
    modelos = list(dict.fromkeys(modelos)) # Eliminar duplicados

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
                continue # Salto por cuota agotada
        except:
            continue
    return None

def salvar_reporte_en_drive(contenido, subcarpeta, prefijo):
    """Guarda los informes generados por la IA en Google Drive."""
    try:
        drive_service = obtener_servicio_drive()
        id_destino = resolver_ruta_inteligente(datetime.now(), subcarpeta)
        nombre_archivo = f"{prefijo}_{datetime.now().strftime('%d_%m_%Y')}.md"
        media = MediaIoBaseUpload(io.BytesIO(contenido.encode('utf-8')), mimetype='text/markdown')
        drive_service.files().create(body={'name': nombre_archivo, 'parents': [id_destino]}, media_body=media).execute()
        return True
    except:
        return False

def generar_resumen_pre_entreno():
    """Genera el briefing de las 09:00 AM (Readiness Report)."""
    estado = leer_estado_maestro(FILE_ID_MAESTRO)
    historial = descargar_memoria_lineal()

    prompt = f"""
    TASK: Readiness report for an athlete.
    DATA: {json.dumps(estado)}.
    LOGS: {historial[-2000:]}.
    MANDATORY: Verify 7g Creatine and mention morning vetoes (Magnesium/Omega3).
    OUTPUT: Spanish, Senior Technical tone, Markdown format.
    """

    report = ejecutar_peticion_rest(prompt, "gemini-3.1-pro-preview")
    if report:
        actualizar_memoria_lineal("[SYSTEM] Briefing matutino generado.")
        return salvar_reporte_en_drive(report, "02_RESUMEN_DIARIO_IA", "PRE_ENTRENO")
    return False

def extraer_metadatos_entreno(texto_crudo):
    """Extrae fecha y tipo de rutina validando que la respuesta no sea None."""
    prompt = f"Extract JSON {{'fecha': 'YYYY-MM-DD', 'tipo': 'PUSH/PULL/LEG'}} from: {texto_crudo[:500]}"
    res = ejecutar_peticion_rest(prompt, "gemini-3.1-flash-lite")

    if res is None:
        return datetime.now(), "ENTRENO"

    try:
        clean_json = res.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_json)
        fecha_str = data.get('fecha', 'TODAY')
        fecha_dt = datetime.now() if fecha_str == "TODAY" else datetime.strptime(fecha_str, "%Y-%m-%d")
        return fecha_dt, data.get('tipo', 'ENTRENO').upper()
    except:
        return datetime.now(), "ENTRENO"

def procesar_entrenamiento_llm(raw_text, estado_maestro, formato="txt"):
    """Análisis biomecánico post-entreno con validación de respuesta."""
    prompt = f"Audit workout performance: {raw_text}. Context: {json.dumps(estado_maestro)}. SPANISH."
    res = ejecutar_peticion_rest(prompt, "gemini-3.1-flash-lite")

    if res is None:
        return "Error en el motor de análisis."

    actualizar_memoria_lineal(f"\n### REPORTE POST-ENTRENO\n{res}")
    return res

def procesar_telemetria_nativa_api(payload):
    """Procesamiento de datos de Fitbit/Google Health."""
    historial_mes = descargar_memoria_lineal()
    prompt = f"Analyze health telemetry: {json.dumps(payload)}. Context: {historial_mes}. SPANISH."
    resultado = ejecutar_peticion_rest(prompt, "gemini-3.1-flash-lite")
    if resultado:
        actualizar_memoria_lineal(f"[TELEMETRÍA] {resultado.strip()}")

def sincronizar_biometria_fit():
    """Sincroniza el peso desde Google Fitness API."""
    try:
        estado = leer_estado_maestro(FILE_ID_MAESTRO)
        token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
        if not token_env: return False

        creds = Credentials.from_authorized_user_info(json.loads(token_env))
        service = build('fitness', 'v1', credentials=creds)

        ahora = int(time.time() * 1000)
        res = service.users().dataset().aggregate(userId='me', body={
            "aggregateBy": [{"dataTypeName": "com.google.weight"}],
            "bucketByTime": {"durationMillis": 86400000},
            "startTimeMillis": ahora - 86400000,
            "endTimeMillis": ahora
        }).execute()

        for bucket in res.get('bucket', []):
            for dataset in bucket.get('dataset', []):
                for point in dataset.get('point', []):
                    val = point.get('value', [])[0].get('fpVal')
                    if val and round(val, 1) != round(estado["biometria_actual"]["peso_kg"], 1):
                        estado["biometria_actual"]["peso_kg"] = round(val, 1)
                        actualizar_estado_maestro(FILE_ID_MAESTRO, estado)
                        actualizar_memoria_lineal(f"[PESO] Sincronizado: {round(val, 1)}kg.")
                        return True
        return False
    except:
        return False
