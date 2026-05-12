"""
Cerebro del sistema. Orquesta:
  - Llamadas a DeepSeek V4 (Pro + Flash) con cascada anti-rate-limit.
    Endpoint OpenAI-compatible: https://api.deepseek.com/chat/completions
  - 3 reportes diarios (PRE / POST / NOCHE) en HTML + memoria lineal IA
  - Mutación validada del JSON maestro (5 guardarraíles clínicos)
  - Análisis del CSV histórico de entrenos → PERFIL_ATLETA.md
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any

import pytz
import requests
from pydantic import ValidationError
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from ..auth import calcular_edad
from ..models import validar
from .drive_engine import (
    actualizar_estado_maestro,
    actualizar_memoria_lineal,
    descargar_csv_contexto,
    descargar_memoria_lineal,
    descargar_rutina_oficial,
    guardar_perfil_atleta,
    leer_estado_maestro,
    leer_perfil_atleta,
    volcar_log_sistema,
    volcar_reporte_html,
)
from .health_engine import resumen_telemetria_critica, snapshot_diario_completo

ZONA_HORARIA = pytz.timezone("Europe/Madrid")

# ──────────────────────────────────────────────────────────────────────────
# CASCADA DEEPSEEK V4 (anti-rate-limit + downgrade automático de tier)
# Pro = razonamiento clínico (HRV, déficit calórico, periodización).
# Flash = generación HTML estructurada y extracción rápida.
# Si Pro 429/5xx → cae a Flash; si Flash también falla → todo el día se loggea.
# ──────────────────────────────────────────────────────────────────────────

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

# Nombres oficiales según https://api-docs.deepseek.com/quick_start/pricing


def _dedupe(items: list[str]) -> list[str]:
    """Mantiene orden eliminando duplicados."""
    visto: set[str] = set()
    out: list[str] = []
    for x in items:
        if x and x not in visto:
            out.append(x)
            visto.add(x)
    return out


CADENA_COMPLEJA = _dedupe([
    os.environ.get("DEEPSEEK_MODEL_COMPLEX", "deepseek-v4-pro"),
    "deepseek-v4-pro",
    "deepseek-v4-flash",
])

CADENA_SIMPLE = _dedupe([
    os.environ.get("DEEPSEEK_MODEL_SIMPLE", "deepseek-v4-flash"),
    "deepseek-v4-flash",
    "deepseek-v4-pro",
])


def _ahora() -> datetime:
    return datetime.now(ZONA_HORARIA)


def _es_reintentable(exc: BaseException) -> bool:
    """
    Solo reintenta errores transitorios DENTRO del mismo modelo.

    429 = saldo agotado / RPM excedido → no reintentar, saltar al siguiente
    modelo (recuperación en segundos no garantizada).
    401/402/403/404/400 = definitivos (auth, billing, modelo no existe).
    5xx + red = sí reintenta (3 intentos con backoff exponencial).
    """
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        return exc.response.status_code in (500, 502, 503, 504)
    return isinstance(exc, (requests.ConnectionError, requests.Timeout))


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception(_es_reintentable),
    reraise=True,
)
def _llamar_modelo(modelo: str, prompt: str, max_tokens: int) -> str:
    """
    Llama a DeepSeek vía endpoint OpenAI-compatible.

    Thinking mode: por defecto ACTIVO en V4 (mejor razonamiento clínico).
    Para tareas SIMPLES (extracción metadatos, mutación JSON estricta) se
    desactiva enviando `enable_thinking=False` para reducir latencia y coste.
    Si la cuenta tiene caching habilitado, los bloques estables del prompt
    (IDENTIDAD + PERFIL + GUARDARRAILES) cuestan ~1/40 del precio normal.
    """
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY no inyectada.")

    # IMPORTANTE: la API v4 SIEMPRE razona (no hay forma de desactivar thinking).
    # `enable_thinking=False` se acepta pero se IGNORA silenciosamente, y consume
    # el budget de max_tokens en reasoning_content (en chino) sin generar content.
    # Por eso NO lo enviamos. En su lugar damos max_tokens generoso para que
    # quepan reasoning + content.
    payload: dict[str, Any] = {
        "model": modelo,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.15,
        "max_tokens": max_tokens,
        "top_p": 0.95,
        "stream": False,
    }

    resp = requests.post(
        DEEPSEEK_URL,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        json=payload,
        timeout=180,
    )
    resp.raise_for_status()
    data = resp.json()
    choices = data.get("choices") or []
    msg0 = choices[0].get("message", {}) if choices else {}
    content = msg0.get("content", "") or ""
    finish = choices[0].get("finish_reason", "UNKNOWN") if choices else "UNKNOWN"
    usage = data.get("usage", {}) or {}
    reasoning_tokens = (usage.get("completion_tokens_details") or {}).get("reasoning_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    if content.strip():
        return content
    # content vacío: casi siempre es reasoning agotó el budget (finish_reason=length).
    raise RuntimeError(
        f"Respuesta de {modelo} sin texto (finish={finish}, "
        f"reasoning_tokens={reasoning_tokens}, completion_tokens={completion_tokens}, "
        f"max_tokens={max_tokens}). Probablemente reasoning agotó budget."
    )


def llamar_llm(prompt: str, complejo: bool = True, max_tokens: int = 16384) -> str | None:
    """
    Recorre la cadena de modelos hasta obtener respuesta.
    Devuelve None si TODA la cadena falla.

    Para cada modelo:
    - Intento 1 con max_tokens dado.
    - Si el modelo devolvió content vacío por agotar reasoning (RuntimeError
      con "reasoning"), intento 2 duplicando max_tokens (hasta 32768).
    - Cualquier otro error: salta al siguiente modelo.

    Loguea a stderr (visible en scripts locales) + a Drive (visible en Cloud Run).
    """
    import sys
    cadena = CADENA_COMPLEJA if complejo else CADENA_SIMPLE
    errores: list[str] = []

    for modelo in cadena:
        # Primer intento con max_tokens dado; segundo intento duplicando hasta 32768
        # SOLO si la causa fue content vacío por reasoning (no si fue 5xx/auth/etc).
        intentos = [max_tokens, min(max_tokens * 2, 32768)]
        if intentos[1] <= intentos[0]:
            intentos = [max_tokens]
        salto_modelo = False
        for idx, mt in enumerate(intentos):
            try:
                return _llamar_modelo(modelo, prompt, mt)
            except RuntimeError as e:
                msg_e = str(e)
                # content vacío por reasoning agotado → reintentamos doblando budget
                if "reasoning" in msg_e.lower() and idx + 1 < len(intentos):
                    aviso = (
                        f"[LLM] {modelo} → content vacío con max_tokens={mt}. "
                        f"Reintento con {intentos[idx + 1]}."
                    )
                    print(aviso, file=sys.stderr)
                    try:
                        volcar_log_sistema(aviso, f"WARN_LLM_RETRY_{_ahora().strftime('%H%M%S')}.txt")
                    except Exception:
                        pass
                    continue
                msg = f"[LLM] {modelo} → RuntimeError: {msg_e[:300]}"
                errores.append(msg)
                print(msg, file=sys.stderr)
                try:
                    volcar_log_sistema(msg, f"ERR_LLM_{_ahora().strftime('%H%M%S')}.txt")
                except Exception:
                    pass
                salto_modelo = True
                break
            except requests.HTTPError as e:
                code = e.response.status_code if e.response is not None else 0
                cuerpo = e.response.text[:300] if e.response is not None else ""
                msg = f"[LLM] {modelo} → HTTP {code}: {cuerpo}"
                errores.append(msg)
                print(msg, file=sys.stderr)
                try:
                    volcar_log_sistema(msg, f"WARN_LLM_{_ahora().strftime('%H%M%S')}.txt")
                except Exception:
                    pass
                salto_modelo = True
                break
            except Exception as e:
                msg = f"[LLM] {modelo} → {type(e).__name__}: {str(e)[:300]}"
                errores.append(msg)
                print(msg, file=sys.stderr)
                try:
                    volcar_log_sistema(msg, f"ERR_LLM_{_ahora().strftime('%H%M%S')}.txt")
                except Exception:
                    pass
                salto_modelo = True
                break
        if salto_modelo:
            continue

    resumen = "[LLM CRÍTICO] Toda la cadena falló.\n" + "\n".join(errores)
    print(resumen, file=sys.stderr)
    try:
        volcar_log_sistema(resumen, f"ERR_LLM_TOTAL_{_ahora().strftime('%H%M%S')}.txt")
    except Exception:
        pass
    return None


def _limpiar_html(raw: str) -> str:
    return raw.replace("```html", "").replace("```", "").strip()


def _limpiar_json(raw: str) -> str:
    return raw.replace("```json", "").replace("```", "").strip()


# ──────────────────────────────────────────────────────────────────────────
# CONTEXTO COMÚN PARA LOS 3 REPORTES
# ──────────────────────────────────────────────────────────────────────────

GUARDARRAILES_DOC = """
GUARDARRAÍLES CLÍNICOS DUROS (NO SUGERENCIAS, REGLAS):
1. Si HRV cae > 15% vs baseline 7d durante 3 días seguidos → ORDENAR deload obligatorio y +200 kcal ese día.
2. Si pérdida de peso > 1.0 kg/semana sostenida 2 semanas → REDUCIR déficit a -250 kcal (protege músculo).
3. Si TOP_SET cae > 10% en mismo ejercicio durante 2 sesiones consecutivas → BANDERA ROJA: subir proteína a 2.8 g/kg + revisar sueño.
4. Si sueño < 6h durante 3 días seguidos → POSPONER LEG day, sustituir por PULL ligero.
5. Si RPE auto-reportado >= 9 en 2 sesiones seguidas con HRV plano → SUBIR carbos a 220 g ese día (rebote glucógeno).
"""

# ──────────────────────────────────────────────────────────────────────────
# CALENDARIO SEMANAL: rotación de grupos + hidratación específica
# ──────────────────────────────────────────────────────────────────────────
# weekday(): 0=lunes, 1=martes, 2=miércoles, 3=jueves, 4=viernes, 5=sáb, 6=dom
ROTACION_SEMANAL: dict[int, dict[str, str]] = {
    0: {"grupo": "PULL",     "hidratacion": "Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)"},
    1: {"grupo": "PUSH",     "hidratacion": "Agua de coco"},
    2: {"grupo": "LEG",      "hidratacion": "Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)"},
    3: {"grupo": "PULL",     "hidratacion": "Limonada casera (agua + sal + bicarbonato + zumo de limón + edulcorante)"},
    4: {"grupo": "PUSH",     "hidratacion": "Agua de coco"},
    5: {"grupo": "DESCANSO", "hidratacion": "Solo agua mineral"},
    6: {"grupo": "DESCANSO", "hidratacion": "Solo agua mineral"},
}

NOMBRE_DIA_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
NOMBRE_MES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                 "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def _bloque_fecha_y_rotacion(ahora_dt: datetime) -> str:
    """
    Devuelve un bloque de texto explícito con FECHA + DÍA + ROTACIÓN + HIDRATACIÓN
    para inyectarlo en cada prompt. Sin esto, el LLM inventa la fecha.
    """
    wd = ahora_dt.weekday()
    rot = ROTACION_SEMANAL[wd]
    fecha_humana = (
        f"{NOMBRE_DIA_ES[wd]} {ahora_dt.day} de {NOMBRE_MES_ES[ahora_dt.month - 1]} "
        f"de {ahora_dt.year}"
    )
    es_domingo = wd == 6
    plan_compra = (
        "HOY ES DOMINGO: incluye al final un bloque resumen de COMPRA SEMANAL "
        "(lista corta de alimentos clave para los 5 entrenos + descansos). Máx 8 viñetas."
        if es_domingo
        else "HOY NO ES DOMINGO: NO generes lista de la compra. La compra la gestiona el padre del atleta."
    )
    return f"""
FECHA Y CALENDARIO (FUENTE DE VERDAD — NO INVENTAR):
- Fecha local Madrid: {fecha_humana}
- Día de la semana: {NOMBRE_DIA_ES[wd]} (weekday={wd})
- Grupo muscular previsto hoy según rotación oficial: {rot['grupo']}
- Hidratación oficial en gimnasio para hoy: {rot['hidratacion']}

SUPLEMENTACIÓN DIARIA FIJA:
- Creatina monohidrato 7 g/día (siempre, no negociable).
- Magnesio y Omega-3: NO comprados aún. NO incluir en el plan hasta nuevo aviso.

POLÍTICA DE LISTA DE LA COMPRA:
- {plan_compra}
"""


def _contexto_atleta(estado: dict) -> str:
    edad = calcular_edad()
    historico = descargar_memoria_lineal()[-3000:]
    historico_prev = descargar_memoria_lineal(mes_offset=1)[-1500:]
    perfil = leer_perfil_atleta()[:2000]
    rutina = descargar_rutina_oficial()[:4000]

    return f"""
ATLETA:
- Nombre: {estado['identidad']['nombre']}
- Edad: {edad} años (FechaNac: {estado['identidad']['fecha_nacimiento']})
- Sexo: {estado['identidad']['sexo']} | Altura: {estado['identidad']['altura_cm']} cm
- Peso actual: {estado['biometria_actual']['peso_kg']} kg | IMC: {estado['biometria_actual']['imc']}
- Body fat estimado: {estado['biometria_actual']['body_fat_estimado_pct']}%
- Masa libre de grasa: {estado['biometria_actual']['masa_libre_grasa_kg']} kg
- Tendencia 7d: {estado['biometria_actual']['tendencia_peso_7dias_kg']} kg

OBJETIVO ACTUAL ({estado['objetivo']['tipo']}):
- kcal target: {estado['objetivo']['kcal_target']}
- Proteína: {estado['objetivo']['proteina_g']} g
- Grasa: {estado['objetivo']['grasa_g']} g
- Carbos: {estado['objetivo']['carbos_g']} g
- Creatina: {estado['objetivo']['creatina_g']} g (monohidrato)
- Agua: {estado['objetivo']['agua_l']} L

GUARDARRAÍLES ACTIVOS:
{json.dumps(estado['guardarrailes_activos'], indent=2, ensure_ascii=False)}

RUTINA OFICIAL VIGENTE (fuente de verdad para series, pesos y técnica):
{rutina}

PERFIL ATLETA (síntesis del histórico CSV):
{perfil}

MEMORIA LINEAL MES ACTUAL (últimos 3000 chars):
{historico}

MEMORIA MES ANTERIOR (últimos 1500 chars):
{historico_prev}
"""


# ──────────────────────────────────────────────────────────────────────────
# REPORTE 1: PRE-ENTRENO (08:50 Madrid)
# ──────────────────────────────────────────────────────────────────────────

def generar_pre_entreno() -> bool:
    file_id = os.environ.get("FILE_ID_MAESTRO")
    if not file_id:
        volcar_log_sistema("[ERROR] FILE_ID_MAESTRO no configurado", "ERR_SISTEMA.txt")
        return False

    try:
        estado = leer_estado_maestro(file_id)
    except Exception as e:
        volcar_log_sistema(f"[ERROR] Leyendo JSON maestro: {e}", "ERR_MAESTRO.txt")
        return False

    snapshot = snapshot_diario_completo()
    telemetria = resumen_telemetria_critica(snapshot)

    from .drive_engine import volcar_health_raw
    try:
        volcar_health_raw(snapshot, _ahora(), "0850")
    except Exception as e:
        volcar_log_sistema(f"[WARN] No se pudo guardar snapshot crudo: {e}", "WARN_HEALTH_RAW.txt")

    prompt = f"""
ROL: Eres un Senior Performance Architect + Nutricionista Clínico de élite.
TAREA: Briefing de Readiness diario (PRE-entreno) en formato HTML.

{_bloque_fecha_y_rotacion(_ahora())}

{_contexto_atleta(estado)}

TELEMETRÍA FITBIT AIR (últimas 24h):
{json.dumps(telemetria, indent=2, ensure_ascii=False)}

{GUARDARRAILES_DOC}

INSTRUCCIONES:
1. Usa SIEMPRE la fecha y el día de la semana que aparecen en el bloque FECHA Y CALENDARIO arriba. Nunca inventes otra fecha.
2. Analiza fatiga del SNC con HRV, sueño y resting HR.
3. Decide si hoy entrena o descansa (aplica guardarraíles + rotación oficial).
4. Si entrena: usa el grupo muscular previsto del bloque FECHA Y CALENDARIO. Lista los ejercicios concretos de RUTINA OFICIAL VIGENTE con sus pesos y ajustes (RIR, +2.5 kg si toca).
5. Plan nutricional del día: desayuno, comida, cena, snack pre y post entreno con números exactos (g proteína, g carbos, g grasa). Suma debe cuadrar con kcal_target.
6. Hidratación en el gimnasio: usa EXACTAMENTE la bebida del bloque FECHA Y CALENDARIO (limonada casera o agua de coco según día).
7. Recordatorio creatina 7 g/día y momento ideal de tomarla. Magnesio/Omega-3 SOLO mencionar como "pendiente de compra".
8. Lista de la compra: aplica la POLÍTICA DE LISTA DE LA COMPRA del bloque FECHA Y CALENDARIO. Si hoy no es domingo, NO incluyas ninguna sección de compra.
9. Si los datos de la pulsera vienen NULL (todavía sin pulsera), trabaja solo con el JSON maestro y CSV histórico.

FORMATO DE SALIDA OBLIGATORIO:
- HTML PURO. Nada de markdown, nada de ```html.
- Usa <h2> títulos principales, <h3> subtítulos, <ul><li>, <b> para negrita, <table> con clase 'plan' para macros.
- Idioma: español clínico, directo, sin filler.
"""
    res = llamar_llm(prompt, complejo=True, max_tokens=16384)
    if not res:
        return False

    html = _limpiar_html(res)
    volcar_reporte_html(html, _ahora(), "01_PRE_ENTRENO")

    linea_ia = (
        f"[PRE_ENTRENO] HRV={telemetria.get('hrv_diario')} | "
        f"Sueño={telemetria.get('sueno_horas')}h | "
        f"RHR={telemetria.get('frecuencia_reposo_bpm')} | "
        f"Peso={telemetria.get('peso_actual_kg') or estado['biometria_actual']['peso_kg']}"
    )
    actualizar_memoria_lineal(linea_ia, html)
    return True


# ──────────────────────────────────────────────────────────────────────────
# REPORTE 2: POST-ENTRENO (disparado por webhook Lyfta)
# ──────────────────────────────────────────────────────────────────────────

def extraer_metadatos_entreno(raw_text: str) -> tuple[datetime, str]:
    """Identifica fecha y tipo (PUSH/PULL/LEG) del entreno Lyfta."""
    prompt = (
        f'Extrae JSON {{"fecha":"YYYY-MM-DD","tipo":"PUSH|PULL|LEG"}} '
        f'del siguiente texto de entreno. Si no hay fecha clara devuelve "TODAY". '
        f'Devuelve SOLO JSON sin markdown:\n\n{raw_text[:800]}'
    )
    res = llamar_llm(prompt, complejo=False, max_tokens=200)
    ahora = _ahora()
    if not res:
        return ahora, "ENTRENO"
    try:
        data = json.loads(_limpiar_json(res))
        fecha_str = data.get("fecha", "TODAY")
        if fecha_str == "TODAY":
            fecha_dt = ahora
        else:
            fecha_dt = datetime.strptime(fecha_str, "%Y-%m-%d").replace(tzinfo=ZONA_HORARIA)
        return fecha_dt, str(data.get("tipo", "ENTRENO")).upper()
    except Exception:
        return ahora, "ENTRENO"


def generar_post_entreno(raw_text: str) -> bool:
    file_id = os.environ.get("FILE_ID_MAESTRO")
    if not file_id:
        volcar_log_sistema("[ERROR] FILE_ID_MAESTRO no configurado", "ERR_SISTEMA.txt")
        return False

    try:
        estado = leer_estado_maestro(file_id)
    except Exception as e:
        volcar_log_sistema(f"[ERROR] Leyendo JSON maestro: {e}", "ERR_MAESTRO.txt")
        return False

    snapshot = snapshot_diario_completo()
    telemetria = resumen_telemetria_critica(snapshot)

    prompt = f"""
ROL: Senior Performance Architect + Nutricionista Clínico de élite.
TAREA: Auditoría POST-entreno + ajuste calórico/macros del resto del día.

{_bloque_fecha_y_rotacion(_ahora())}

{_contexto_atleta(estado)}

TELEMETRÍA FITBIT AIR HOY:
{json.dumps(telemetria, indent=2, ensure_ascii=False)}

ENTRENO QUE ACABA DE REALIZAR (Lyfta TXT):
{raw_text[:6000]}

{GUARDARRAILES_DOC}

INSTRUCCIONES:
1. Usa SIEMPRE la fecha y el día de la semana del bloque FECHA Y CALENDARIO. Nunca inventes otra fecha.
2. Audita el entreno: progresión vs PRs históricos, RPE estimado, calidad de la sesión.
3. Compara TOP_SETS con la última sesión del mismo grupo (aplica guardarraíl #3 si procede). Si hay Lateral Raise, recuerda que es TRISERIE en dropset (3 series × 30 reps = 90 reps totales), no 9 series independientes.
4. Calcula kcal y macros restantes del día (lo que ya consumió vs target).
5. Plan exacto de comida POST-entreno (g proteína, g carbos, ventana de 90 min).
6. Plan exacto de cena + snack nocturno si quedan macros pendientes.
7. Recordatorio creatina 7 g/día si no la ha tomado hoy. NO sugerir magnesio ni Omega-3 (pendientes de compra).
8. Predicción de progresión para la PRÓXIMA sesión del mismo grupo (basado en RUTINA OFICIAL VIGENTE).
9. NO incluyas lista de la compra: aplica la POLÍTICA del bloque FECHA Y CALENDARIO (solo el domingo).

FORMATO DE SALIDA OBLIGATORIO:
- HTML PURO. Nada de markdown.
- <h2>, <h3>, <ul>, <table class='plan'>.
- Español clínico.
"""
    res = llamar_llm(prompt, complejo=True, max_tokens=16384)
    if not res:
        return False

    html = _limpiar_html(res)
    fecha_dt, tipo = extraer_metadatos_entreno(raw_text)
    volcar_reporte_html(html, fecha_dt, "02_POST_ENTRENO")

    # Mutación validada del JSON maestro
    estado_mutado = evaluar_mutacion_estado(raw_text, estado)

    linea_ia = (
        f"[POST_ENTRENO {tipo}] Peso registrado: "
        f"{estado_mutado['biometria_actual']['peso_kg']}kg | "
        f"HRV={telemetria.get('hrv_diario')} | Sueño={telemetria.get('sueno_horas')}h"
    )
    actualizar_memoria_lineal(linea_ia, html)
    return True


# ──────────────────────────────────────────────────────────────────────────
# REPORTE 3: RESUMEN NOCHE (23:00 Madrid)
# ──────────────────────────────────────────────────────────────────────────

def generar_resumen_noche() -> bool:
    file_id = os.environ.get("FILE_ID_MAESTRO")
    if not file_id:
        volcar_log_sistema("[ERROR] FILE_ID_MAESTRO no configurado", "ERR_SISTEMA.txt")
        return False

    try:
        estado = leer_estado_maestro(file_id)
    except Exception as e:
        volcar_log_sistema(f"[ERROR] Leyendo JSON maestro: {e}", "ERR_MAESTRO.txt")
        return False

    snapshot = snapshot_diario_completo()
    telemetria = resumen_telemetria_critica(snapshot)

    from .drive_engine import volcar_health_raw
    try:
        volcar_health_raw(snapshot, _ahora(), "2300")
    except Exception:
        pass

    prompt = f"""
ROL: Senior Performance Architect + Nutricionista Clínico de élite.
TAREA: Cierre del día. Resumen general, comparativa vs target y predicción mañana.

{_bloque_fecha_y_rotacion(_ahora())}

{_contexto_atleta(estado)}

TELEMETRÍA FITBIT AIR FINAL DEL DÍA:
{json.dumps(telemetria, indent=2, ensure_ascii=False)}

{GUARDARRAILES_DOC}

INSTRUCCIONES:
1. Usa SIEMPRE la fecha y el día de la semana del bloque FECHA Y CALENDARIO. Nunca inventes otra fecha.
2. Cierre nutricional: kcal y macros conseguidos vs target. % adherencia.
3. Cierre entreno: si entrenó hoy, calidad de sesión; si descansó, justificación.
4. Estado SNC: tendencia HRV 7d, sueño promedio 7d, banderas activadas.
5. Tendencias 7d (peso, fuerza media en TOP_SETS, sueño).
6. Plan de mañana: qué grupo toca (cruza FECHA+1 contra rotación oficial), qué hora dormir, qué desayuno preparar, qué hidratación llevar al gym.
7. Si guardarraíles disparan, ESCRIBE LA RECOMENDACIÓN COMO ORDEN, no sugerencia.
8. Lista de la compra: aplica la POLÍTICA del bloque FECHA Y CALENDARIO. SOLO el domingo incluye un resumen semanal corto (máx 8 viñetas) para que el padre lo compre el lunes.

FORMATO DE SALIDA OBLIGATORIO:
- HTML PURO. <h2>, <h3>, <ul>, <table>.
- Español clínico.
"""
    res = llamar_llm(prompt, complejo=True, max_tokens=16384)
    if not res:
        return False

    html = _limpiar_html(res)
    volcar_reporte_html(html, _ahora(), "03_RESUMEN_NOCHE")

    linea_ia = (
        f"[RESUMEN_NOCHE] Pasos={telemetria.get('pasos')} | "
        f"Calorías={telemetria.get('calorias_total')} | "
        f"AZM={telemetria.get('active_zone_min')} | "
        f"VO2max={telemetria.get('vo2_max')}"
    )
    actualizar_memoria_lineal(linea_ia, html)
    return True


# ──────────────────────────────────────────────────────────────────────────
# MUTACIÓN VALIDADA DEL JSON MAESTRO
# ──────────────────────────────────────────────────────────────────────────

def evaluar_mutacion_estado(raw_text: str, estado_actual: dict) -> dict:
    """
    Si el texto del entreno menciona un nuevo peso/medida, muta el JSON maestro.
    Toda mutación pasa por validación Pydantic antes de escribirse.
    """
    file_id = os.environ.get("FILE_ID_MAESTRO")
    if not file_id:
        return estado_actual

    prompt = f"""
ROL: Analizador biométrico estricto.
TAREA: Revisa el texto y devuelve el JSON maestro mutado SI hay cambios biométricos explícitos.

REGLAS:
1. Si el usuario menciona explícitamente nuevo peso ("peso 81kg", "peso ayunas 80"), actualiza biometria_actual.peso_kg.
2. Recalcula imc = peso / (altura_m^2).
3. Recalcula masa_libre_grasa_kg = peso * (1 - body_fat/100).
4. Recalcula tendencia_peso_7dias_kg = peso_nuevo - peso_baseline_2sem.
5. Si NO hay cambios explícitos, devuelve el JSON original SIN MODIFICAR.
6. Devuelve SOLO JSON crudo (sin ```json, sin texto extra).
7. NUNCA inventes campos nuevos. Estructura exacta igual al original.

CURRENT_STATE:
{json.dumps(estado_actual, indent=2, ensure_ascii=False)}

WORKOUT_RAW (últimos 1500 chars):
{raw_text[-1500:]}
"""
    res = llamar_llm(prompt, complejo=False, max_tokens=2048)
    if not res:
        return estado_actual

    try:
        nuevo = json.loads(_limpiar_json(res))
    except json.JSONDecodeError as e:
        volcar_log_sistema(
            f"[MUTACIÓN] LLM devolvió JSON inválido: {e}", "ERR_MUTACION.txt"
        )
        return estado_actual

    try:
        validar(nuevo)
    except ValidationError as ve:
        volcar_log_sistema(
            f"[MUTACIÓN BLOQUEADA] Esquema inválido: {ve.json()[:1000]}",
            "ERR_MUTACION_SCHEMA.txt",
        )
        return estado_actual

    if nuevo == estado_actual:
        return estado_actual

    try:
        actualizar_estado_maestro(file_id, nuevo)
        actualizar_memoria_lineal(
            f"[MUTACIÓN VALIDADA] Peso: {estado_actual['biometria_actual']['peso_kg']} → "
            f"{nuevo['biometria_actual']['peso_kg']}",
        )
        return nuevo
    except Exception as e:
        volcar_log_sistema(f"[ERROR] Persistiendo mutación: {e}", "ERR_MUTACION_WRITE.txt")
        return estado_actual


# ──────────────────────────────────────────────────────────────────────────
# GENERACIÓN INICIAL DEL PERFIL_ATLETA.md (UNA VEZ AL ARRANQUE)
# ──────────────────────────────────────────────────────────────────────────

def generar_perfil_atleta_desde_csv() -> bool:
    csv_texto = descargar_csv_contexto()
    if not csv_texto:
        volcar_log_sistema(
            "[WARN] CSV histórico no encontrado en 00_CONTEXTO_HISTORICO",
            "WARN_PERFIL.txt",
        )
        return False

    prompt = f"""
ROL: Senior S&C Coach analizando un historial de entrenamiento.
TAREA: Genera un PERFIL_ATLETA.md sintetizando el CSV. Formato Markdown.

CSV CRUDO (148 entrenos):
{csv_texto[:60000]}

PRODUCE EXACTAMENTE ESTAS SECCIONES (en Markdown):

# Perfil Atleta
## Nivel general
(1 frase con clasificación: principiante / intermedio / avanzado / competitivo amateur, justificando con ratios fuerza/peso)

## PRs principales (TOP_SETS)
| Ejercicio | Peso máx (kg) | Reps | Ratio/BW |
|---|---|---|---|
(top 10 ejercicios por peso máximo)

## Frecuencia y volumen
- Sesiones promedio/semana
- Distribución PUSH/PULL/LEG
- Duración media de sesión

## Tendencias de progresión
(3-5 viñetas con ejercicios que están subiendo o estancados)

## Puntos fuertes y débiles
(2 viñetas cada uno, comparando con estándares para 19 años y 82 kg BW)

## Recomendaciones de cara al cutting agresivo
(3 viñetas: cómo proteger fuerza, riesgos a vigilar, KPIs)

INSTRUCCIONES:
- Tono clínico, español, sin filler.
- Asume BW = 82 kg para ratios.
- NO inventes datos: si una métrica no es deducible, escribe "N/D".
- Devuelve SOLO el Markdown, sin texto introductorio.
"""
    res = llamar_llm(prompt, complejo=True, max_tokens=16384)
    if not res:
        return False

    guardar_perfil_atleta(res.strip())
    actualizar_memoria_lineal("[PERFIL_ATLETA] Generado desde CSV histórico de 148 entrenos.")
    return True
