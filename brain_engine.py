import os
import json
import io
from datetime import datetime
import requests
import pytz
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

# Importaciones del motor de persistencia (drive_engine.py)
from drive_engine import (
    leer_estado_maestro,
    descargar_memoria_lineal,
    actualizar_memoria_lineal,
    volcar_log_sistema,
    obtener_servicio_drive,
    resolver_ruta_inteligente
)

# CONFIGURACIÓN DE IDENTIDAD Y ACCESO MAESTRO
FILE_ID_MAESTRO = "1POEuCbmOEIURg7UycPsbIrH62uQvJgLI"
RUTINA_MAESTRA = "Lunes: PULL | Martes: PUSH | Miércoles: LEG | Jueves: PULL | Viernes: PUSH"
ZONA_HORARIA = pytz.timezone("Europe/Madrid")

def obtener_ahora():
    """Devuelve la fecha y hora actual ajustada a Madrid."""
    return datetime.now(ZONA_HORARIA)

def ejecutar_peticion_rest(prompt, modelo_preferido="gemini-3.1-pro-preview"):
    """Inferencia con sistema de redundancia para evitar errores de cuota (429)."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key: return None

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
    """Guarda los informes en Drive usando la fecha de Madrid para las carpetas en texto plano."""
    try:
        drive_service = obtener_servicio_drive()
        ahora = obtener_ahora()
        id_destino = resolver_ruta_inteligente(ahora, subcarpeta)

        # Archivo .txt para lectura móvil nativa
        nombre_archivo = f"{prefijo}_{ahora.strftime('%d_%m_%Y')}.txt"

        # Mimetype text/plain
        media = MediaIoBaseUpload(io.BytesIO(contenido.encode('utf-8')), mimetype='text/plain')
        drive_service.files().create(body={'name': nombre_archivo, 'parents': [id_destino]}, media_body=media).execute()
        return True
    except Exception as e:
        volcar_log_sistema(f"DRIVE_ERR: {str(e)}", "ERR_DRIVE.txt", ahora)
        return False

# --- FLUJOS DE INTELIGENCIA ---

def generar_resumen_pre_entreno():
    """Briefing de las 09:00 AM con datos biomecánicos reales."""
    estado = leer_estado_maestro(FILE_ID_MAESTRO)
    historial = descargar_memoria_lineal()
    ahora = obtener_ahora()

    prompt = f"""
    SYSTEM: Senior Performance Architect.
    TASK: Readiness report.
    ATHLETE_DATA: Edad 19 años, Altura 160cm, Peso {estado['biometria_actual']['peso_kg']}kg, Sexo Masculino.
    CONTEXT: {json.dumps(estado)}.
    HISTORY: {historial[-2500:]}.
    ROUTINE: {RUTINA_MAESTRA}.

    MANDATORY PROTOCOLS:
    1. Confirm 7g Creatine intake.
    2. Warning: VETO Magnesium and Omega-3 this morning.
    3. Use technical tone. Spanish language.
    """

    report = ejecutar_peticion_rest(prompt, "gemini-3.1-pro-preview")
    if report:
        actualizar_memoria_lineal(f"[{ahora.isoformat()}] [SYSTEM] Briefing matutino generado.")
        return salvar_reporte_en_drive(report, "02_RESUMEN_DIARIO_IA", "PRE_ENTRENO")
    return False

def extraer_metadatos_entreno(texto_crudo):
    """Extracción de metadatos con validación de tipo."""
    prompt = f"Extract JSON {{'fecha': 'YYYY-MM-DD', 'tipo': 'PUSH/PULL/LEG'}} from: {texto_crudo[:500]}"
    res = ejecutar_peticion_rest(prompt, "gemini-3.1-flash-lite")

    ahora = obtener_ahora()
    if res is None: return ahora, "ENTRENO"

    try:
        clean_json = res.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_json)
        fecha_str = data.get('fecha', 'TODAY')
        fecha_dt = ahora if fecha_str == "TODAY" else datetime.strptime(fecha_str, "%Y-%m-%d").replace(tzinfo=ZONA_HORARIA)
        return fecha_dt, data.get('tipo', 'ENTRENO').upper()
    except:
        return ahora, "ENTRENO"

def procesar_entrenamiento_llm(raw_text, estado_maestro, formato="txt"):
    """Análisis biomecánico post-entreno en texto plano."""
    prompt = f"Audit workout: {raw_text}. Context: {json.dumps(estado_maestro)}. SPANISH. NO USE MARKDOWN FORMATTING, JUST PLAIN TEXT."
    res = ejecutar_peticion_rest(prompt, "gemini-3.1-flash-lite")
    if res is None: return "Error en el motor de análisis."

    # Se guarda en el historial general (que ahora es TXT)
    actualizar_memoria_lineal(f"\n--- REPORTE POST-ENTRENO ---\n{res}")
    return res

def procesar_telemetria_nativa_api(payload):
    """Procesamiento de biométricos."""
    historial_mes = descargar_memoria_lineal()
    prompt = f"Analyze health telemetry: {json.dumps(payload)}. Context: {historial_mes}. SPANISH. NO MARKDOWN, JUST PLAIN TEXT."
    resultado = ejecutar_peticion_rest(prompt, "gemini-3.1-flash-lite")
    if resultado:
        actualizar_memoria_lineal(f"[TELEMETRÍA] {resultado.strip()}")

def sincronizar_biometria_fit():
    """Sincronización del peso corporal (Lógica abstraída)."""
    try:
        token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
        if not token_env: return False
        # creds = Credentials.from_authorized_user_info(json.loads(token_env))
        # service = build('fitness', 'v1', credentials=creds)
        # Lógica de fitness...
        return True
    except: return False
