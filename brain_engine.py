import os
import json
import io
import requests
from datetime import datetime, timedelta
import pytz
from google.oauth2.credentials import Credentials
from googleapiclient.http import MediaIoBaseUpload

# Importaciones del motor de persistencia (drive_engine.py)
from drive_engine import (
    leer_estado_maestro,
    descargar_memoria_lineal,
    actualizar_memoria_lineal,
    volcar_log_sistema,
    obtener_servicio_drive,
    resolver_ruta_diaria # <--- CORREGIDO: Importamos la nueva función de enrutamiento
)

# CONFIGURACIÓN MAESTRA
FILE_ID_MAESTRO = "1POEuCbmOEIURg7UycPsbIrH62uQvJgLI"
RUTINA_MAESTRA = "Lunes: PULL | Martes: PUSH | Miércoles: LEG | Jueves: PULL | Viernes: PUSH"
ZONA_HORARIA = pytz.timezone("Europe/Madrid")

def obtener_ahora():
    return datetime.now(ZONA_HORARIA)

def ejecutar_peticion_rest(prompt, modelo_preferido="gemini-3.1-pro-preview"):
    """Motor de inferencia."""
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
        except: continue
    return None

def salvar_reporte_en_drive(contenido_html, subcarpeta, prefijo):
    """Guarda los informes sueltos diarios en Google Docs Nativo."""
    try:
        drive_service = obtener_servicio_drive()
        ahora = obtener_ahora()

        # Usamos la nueva ruta diaria (SALUD -> AÑO -> MES)
        id_destino = resolver_ruta_diaria(ahora, subcarpeta)

        nombre_archivo = f"{prefijo}_{ahora.strftime('%d_%m_%Y')}"
        media = MediaIoBaseUpload(io.BytesIO(contenido_html.encode('utf-8')), mimetype='text/html')

        metadata = {
            'name': nombre_archivo,
            'parents': [id_destino],
            'mimeType': 'application/vnd.google-apps.document'
        }

        drive_service.files().create(body=metadata, media_body=media).execute()
        return True
    except Exception as e:
        volcar_log_sistema(f"DRIVE_ERR_DOC: {str(e)}", "ERR_DRIVE.txt")
        return False

# --- MOTOR FITBIT AIR: TELEMETRÍA SNC Y RECUPERACIÓN ---

def extraer_telemetria_fitbit():
    """Descarga HRV, Sueño y SpO2 de las últimas 24h para evaluar fatiga del SNC."""
    token_env = os.environ.get("GOOGLE_OAUTH_TOKEN_JSON")
    if not token_env: return None

    creds = Credentials.from_authorized_user_info(json.loads(token_env))
    headers = {'Authorization': f'Bearer {creds.token}'}

    ahora = obtener_ahora()
    hace_24h = ahora - timedelta(days=1)

    start_ns = int(hace_24h.timestamp() * 1e9)
    end_ns = int(ahora.timestamp() * 1e9)
    start_ms = int(hace_24h.timestamp() * 1000)
    end_ms = int(ahora.timestamp() * 1000)

    telemetria = {"sueño_horas": 0, "hrv_promedio": None, "spo2_promedio": None}

    # Sueño
    url_sleep = f"https://www.googleapis.com/fitness/v1/users/me/sessions?startTime={start_ms}&endTime={end_ms}"
    try:
        res_sleep = requests.get(url_sleep, headers=headers).json()
        if 'session' in res_sleep:
            minutos_sueno = sum([(int(s['endTimeMillis']) - int(s['startTimeMillis']))/60000
                                 for s in res_sleep['session'] if s['activityType'] == 72])
            telemetria["sueño_horas"] = round(minutos_sueno / 60, 2)
    except: pass

    # HRV
    ds_id_hrv = f"{start_ns}-{end_ns}"
    url_hrv = f"https://www.googleapis.com/fitness/v1/users/me/dataSources/derived:com.google.heart_rate.variability:com.google.android.gms:merged/datasets/{ds_id_hrv}"
    try:
        res_hrv = requests.get(url_hrv, headers=headers).json()
        puntos = res_hrv.get('point', [])
        if puntos:
            valores = [p['value'][0]['fpVal'] for p in puntos if 'fpVal' in p['value'][0]]
            telemetria["hrv_promedio"] = round(sum(valores)/len(valores), 2) if valores else None
    except: pass

    return telemetria

# --- FLUJOS DE INTELIGENCIA ---

def generar_resumen_pre_entreno():
    """Briefing de Readiness."""
    estado = leer_estado_maestro(FILE_ID_MAESTRO)
    historial = descargar_memoria_lineal()
    ahora = obtener_ahora()

    telemetria_pulsera = extraer_telemetria_fitbit() or {}

    prompt = f"""
    SYSTEM: Senior Performance Architect.
    TASK: Daily Readiness Report.
    ATHLETE_DATA: Edad {estado['identidad']['edad']}, Peso {estado['biometria_actual']['peso_kg']}kg.
    FITBIT_TELEMETRY (Ultimas 24h): {json.dumps(telemetria_pulsera)}
    CONTEXT: {json.dumps(estado)}.
    HISTORY: {historial[-2500:]}.
    ROUTINE: {RUTINA_MAESTRA}.

    MANDATORY PROTOCOLS:
    1. Evaluate Central Nervous System fatigue using HRV and Sleep data.
    2. Adjust volume/intensity recommendations.
    3. Spanish language. Use clinical tone.

    FORMATTING RULES (CRITICAL):
    You MUST output the response in RAW HTML format.
    Use <h2> for main titles, <h3> for subtitles, <ul> and <li> for lists, and <b> for bold text.
    DO NOT wrap the output in ```html tags. Just output the raw HTML code.
    """

    report = ejecutar_peticion_rest(prompt, "gemini-3.1-pro-preview")
    if report:
        clean_html = report.replace("```html", "").replace("```", "").strip()

        # MAGIA DE DOBLE ESCRITURA: Le pasamos el texto crudo a la IA y el HTML a tu Diario Acumulado
        texto_crudo_ia = f"[{ahora.isoformat()}] [READINESS] HRV: {telemetria_pulsera.get('hrv_promedio')}ms | Sueño: {telemetria_pulsera.get('sueño_horas')}h"
        actualizar_memoria_lineal(texto_crudo_ia, clean_html)

        # Guardamos también una copia diaria suelta en 02_RESUMEN_DIARIO_IA
        return salvar_reporte_en_drive(clean_html, "02_RESUMEN_DIARIO_IA", "PRE_ENTRENO")
    return False

def extraer_metadatos_entreno(texto_crudo):
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
    except: return ahora, "ENTRENO"

def procesar_entrenamiento_llm(raw_text, estado_maestro, formato="txt"):
    """Auditoría post-entrenamiento formateada en Google Docs."""
    prompt = f"""
    Audit workout: {raw_text}. Context: {json.dumps(estado_maestro)}. SPANISH.

    FORMATTING RULES (CRITICAL):
    You MUST output the response in RAW HTML format.
    Use <h2> for main titles, <h3> for subtitles, <ul> and <li> for lists, and <b> for bold text.
    DO NOT wrap the output in ```html tags. Just output the raw HTML code.
    """
    res = ejecutar_peticion_rest(prompt, "gemini-3.1-flash-lite")
    if res is None: return "Error en motor."

    clean_html = res.replace("```html", "").replace("```", "").strip()

    # MAGIA DE DOBLE ESCRITURA
    texto_crudo_ia = f"\n--- REPORTE POST-ENTRENO ---\n[Guardado en formato nativo Docs]"
    actualizar_memoria_lineal(texto_crudo_ia, clean_html)

    salvar_reporte_en_drive(clean_html, "02_RESUMEN_DIARIO_IA", f"POST_ENTRENO")
    return res

def procesar_telemetria_nativa_api(payload):
    historial_mes = descargar_memoria_lineal()
    prompt = f"Analyze health telemetry: {json.dumps(payload)}. Context: {historial_mes}. SPANISH. NO MARKDOWN, JUST PLAIN TEXT."
    resultado = ejecutar_peticion_rest(prompt, "gemini-3.1-flash-lite")
    if resultado:
        # Aquí no mandamos HTML porque son solo pings técnicos de la API, no te interesa leerlos visualmente.
        actualizar_memoria_lineal(f"[TELEMETRÍA] {resultado.strip()}")
