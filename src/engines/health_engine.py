"""
Cliente REST contra Google Health API v4 (health.googleapis.com).

Reemplaza la antigua Google Fit API (deprecada 2026-06-30). Cubre los 31
data types oficiales de Fitbit Air → Google Health API. Operaciones soportadas:
list, dailyRollUp, reconcile, getIdentity.

Toda llamada usa el access_token refrescado por src.auth.
"""

from __future__ import annotations

import os
from datetime import datetime, date, timedelta, timezone
from typing import Any

import pytz
import requests
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from ..auth import obtener_access_token

API_BASE = "https://health.googleapis.com/v4"
ZONA_HORARIA = pytz.timezone("Europe/Madrid")

# 31 data types oficiales (kebab-case en endpoints).
# Categorizados por familia para el snapshot diario.
DATA_TYPES_SCALARES = [
    "steps",
    "distance",
    "floors",
    "altitude",
    "active-minutes",
    "active-zone-minutes",
    "total-calories",
    "calories-in-heart-rate-zone",
    "time-in-heart-rate-zone",
    "sedentary-period",
]

DATA_TYPES_CARDIO_RESP = [
    "heart-rate",
    "heart-rate-variability",
    "oxygen-saturation",
    "respiratory-rate-sleep-summary",
    "daily-heart-rate-variability",
    "daily-heart-rate-zones",
    "daily-resting-heart-rate",
    "daily-oxygen-saturation",
    "daily-respiratory-rate",
    "daily-sleep-temperature-derivations",
]

DATA_TYPES_RENDIMIENTO = [
    "vo2-max",
    "daily-vo2-max",
    "run-vo2-max",
    "swim-lengths-data",
]

DATA_TYPES_CORPORALES = [
    "weight",
    "body-fat",
    "height",
]

DATA_TYPES_SESIONES = [
    "sleep",
    "exercise",
    "activity-level",
    "hydration-log",
]

TODOS_DATA_TYPES = (
    DATA_TYPES_SCALARES
    + DATA_TYPES_CARDIO_RESP
    + DATA_TYPES_RENDIMIENTO
    + DATA_TYPES_CORPORALES
    + DATA_TYPES_SESIONES
)


def _ahora_madrid() -> datetime:
    return datetime.now(ZONA_HORARIA)


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {obtener_access_token()}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _retryable(exc: BaseException) -> bool:
    """
    Solo reintenta errores TRANSITORIOS: 5xx, 429, conexión y timeout.
    NO reintenta 4xx (404 = pulsera inactiva, 403 = sin permisos): inútil.
    """
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        sc = exc.response.status_code
        return 500 <= sc < 600 or sc == 429
    return isinstance(exc, (requests.ConnectionError, requests.Timeout))


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_exception(_retryable),
    reraise=True,
)
def _get(url: str, params: dict | None = None) -> dict:
    resp = requests.get(url, headers=_headers(), params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_exception(_retryable),
    reraise=True,
)
def _post(url: str, body: dict) -> dict:
    resp = requests.post(url, headers=_headers(), json=body, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_identity() -> dict:
    """GET /v4/users/me/identity → mapea Fitbit legacyUserId ↔ healthUserId."""
    return _get(f"{API_BASE}/users/me/identity")


def list_datapoints(
    data_type: str,
    civil_start: datetime | None = None,
    civil_end: datetime | None = None,
    page_size: int = 1000,
) -> list[dict]:
    """
    LIST de dataPoints de un tipo, paginando hasta agotar nextPageToken.

    `civil_start`/`civil_end` se pasan como filtro `*.interval.civil_start_time`.
    Para tipos Sample el filtro es `*.sample_time.physical_time` (manejado).
    """
    url = f"{API_BASE}/users/me/dataTypes/{data_type}/dataPoints"
    snake = data_type.replace("-", "_")
    params: dict[str, Any] = {"pageSize": page_size}

    if civil_start:
        iso = civil_start.strftime("%Y-%m-%dT%H:%M:%S")
        # Heurística: tipos "daily-*" usan filtro interval; "sample" tipos usan sample_time.
        filtro = (
            f'{snake}.sample_time.physical_time >= "{iso}Z"'
            if data_type in {"heart-rate", "heart-rate-variability", "oxygen-saturation",
                              "weight", "body-fat", "height", "respiratory-rate-sleep-summary",
                              "vo2-max", "run-vo2-max"}
            else f'{snake}.interval.civil_start_time >= "{iso}"'
        )
        params["filter"] = filtro

    todos: list[dict] = []
    page_token: str | None = None

    while True:
        if page_token:
            params["pageToken"] = page_token
        data = _get(url, params=params)
        todos.extend(data.get("dataPoints", []))
        page_token = data.get("nextPageToken") or None
        if not page_token:
            break

    return todos


def daily_rollup(data_type: str, dia: date) -> dict:
    """
    POST /v4/users/me/dataTypes/{data_type}/dataPoints:dailyRollUp
    Agregación de 1 día en civil time del usuario.
    """
    url = f"{API_BASE}/users/me/dataTypes/{data_type}/dataPoints:dailyRollUp"
    body = {
        "range": {
            "start": {
                "date": {"year": dia.year, "month": dia.month, "day": dia.day},
                "time": {"hours": 0, "minutes": 0, "seconds": 0, "nanos": 0},
            },
            "end": {
                "date": {"year": dia.year, "month": dia.month, "day": dia.day},
                "time": {"hours": 23, "minutes": 59, "seconds": 59, "nanos": 0},
            },
        },
        "windowSizeDays": 1,
    }
    return _post(url, body)


def reconcile(data_type: str, data_source_family: str = "google-wearables",
              civil_start: datetime | None = None) -> list[dict]:
    """
    GET /v4/users/me/dataTypes/{data_type}/dataPoints:reconcile
    Stream reconciliado por familia de fuente (típicamente la pulsera).
    """
    url = f"{API_BASE}/users/me/dataTypes/{data_type}/dataPoints:reconcile"
    params: dict[str, Any] = {"dataSourceFamily": f"users/me/dataSourceFamilies/{data_source_family}"}
    snake = data_type.replace("-", "_")
    if civil_start:
        iso = civil_start.strftime("%Y-%m-%d")
        params["filter"] = f'{snake}.interval.civil_end_time >= "{iso}"'
    data = _get(url, params=params)
    return data.get("dataPoints", [])


def snapshot_diario_completo(dia: date | None = None) -> dict:
    """
    Orquestador: extrae los 31 data types para `dia` (hoy si None).

    KILL SWITCH (FITBIT_ACTIVO): si la env var no es "true", saltamos el
    snapshot entero y devolvemos dict vacío en <50 ms. Necesario porque
    Google Health API responde HTTP 200 con datos vacíos (no 4xx) cuando
    no hay pulsera enrolada todavía, así que el circuit-breaker de abajo
    no se dispara y serializa 31 llamadas lentas hasta WORKER TIMEOUT.
    Activar a "true" SOLO cuando llegue el Fitbit Air (26 mayo 2026).

    CIRCUIT BREAKER: si la primera llamada falla con 4xx (permisos), se
    aborta también devolviendo snapshot vacío.
    """
    dia = dia or _ahora_madrid().date()
    civil_inicio = datetime(dia.year, dia.month, dia.day, 0, 0, 0)

    resultado: dict[str, Any] = {
        "fecha": dia.isoformat(),
        "generado_en": _ahora_madrid().isoformat(),
        "resumenes_diarios": {},
        "cardio_respiratorio": {},
        "rendimiento": {},
        "corporales": {},
        "sesiones": {},
        "errores": [],
        "pulsera_activa": True,
    }

    # KILL SWITCH: si la pulsera aún no está enrolada, salir inmediato.
    if os.environ.get("FITBIT_ACTIVO", "false").lower() != "true":
        resultado["pulsera_activa"] = False
        resultado["errores"].append(
            {"_resumen": "FITBIT_ACTIVO=false. Snapshot saltado (pulsera aún no enrolada)."}
        )
        return resultado

    # CIRCUIT BREAKER: probe con un solo tipo. Si falla con 4xx, no hay pulsera.
    try:
        resultado["resumenes_diarios"]["steps"] = daily_rollup("steps", dia)
    except requests.HTTPError as e:
        sc = e.response.status_code if e.response is not None else 0
        resultado["errores"].append({"tipo": "steps", "etapa": "probe", "http": sc, "error": str(e)[:200]})
        if 400 <= sc < 500:
            resultado["pulsera_activa"] = False
            resultado["errores"].append({"_resumen": f"Circuit-breaker disparado tras steps HTTP {sc}. Resto saltado."})
            return resultado
    except Exception as e:
        resultado["errores"].append({"tipo": "steps", "etapa": "probe", "error": str(e)[:200]})
        resultado["pulsera_activa"] = False
        resultado["errores"].append({"_resumen": "Circuit-breaker disparado por excepción de red. Resto saltado."})
        return resultado

    # 1. Daily rollup para resto de escalares
    for dt in [d for d in DATA_TYPES_SCALARES if d != "steps"]:
        try:
            resultado["resumenes_diarios"][dt] = daily_rollup(dt, dia)
        except Exception as e:
            resultado["errores"].append({"tipo": dt, "etapa": "dailyRollUp", "error": str(e)[:200]})

    # 2. Cardio/respiratorio
    for dt in DATA_TYPES_CARDIO_RESP:
        try:
            resultado["cardio_respiratorio"][dt] = list_datapoints(dt, civil_inicio)
        except Exception as e:
            resultado["errores"].append({"tipo": dt, "etapa": "list", "error": str(e)[:200]})

    # 3. Rendimiento
    for dt in DATA_TYPES_RENDIMIENTO:
        try:
            resultado["rendimiento"][dt] = list_datapoints(dt, civil_inicio)
        except Exception as e:
            resultado["errores"].append({"tipo": dt, "etapa": "list", "error": str(e)[:200]})

    # 4. Corporales
    for dt in DATA_TYPES_CORPORALES:
        try:
            resultado["corporales"][dt] = list_datapoints(dt, civil_inicio)
        except Exception as e:
            resultado["errores"].append({"tipo": dt, "etapa": "list", "error": str(e)[:200]})

    # 5. Sesiones
    for dt in DATA_TYPES_SESIONES:
        try:
            resultado["sesiones"][dt] = list_datapoints(dt, civil_inicio)
        except Exception as e:
            resultado["errores"].append({"tipo": dt, "etapa": "list", "error": str(e)[:200]})

    return resultado


def resumen_telemetria_critica(snapshot: dict) -> dict:
    """
    Extrae las métricas SNC que más nos importan del snapshot completo.
    Esto es lo que ve el LLM en el prompt del Readiness.
    """
    resumen: dict[str, Any] = {
        "sueno_horas": None,
        "sueno_eficiencia": None,
        "sueno_rem_min": None,
        "sueno_profundo_min": None,
        "hrv_promedio_ms": None,
        "hrv_diario": None,
        "frecuencia_reposo_bpm": None,
        "spo2_promedio_pct": None,
        "temperatura_piel_delta": None,
        "respiracion_promedio": None,
        "pasos": None,
        "calorias_total": None,
        "active_zone_min": None,
        "vo2_max": None,
        "peso_actual_kg": None,
    }

    sleeps = snapshot.get("sesiones", {}).get("sleep", []) or []
    if sleeps:
        principal = next(
            (s for s in sleeps if s.get("sleep", {}).get("metadata", {}).get("main")),
            sleeps[0],
        )
        summary = principal.get("sleep", {}).get("summary", {})
        if summary:
            resumen["sueno_horas"] = round(int(summary.get("minutesAsleep", 0)) / 60, 2)
            asleep = int(summary.get("minutesAsleep", 0))
            in_bed = int(summary.get("minutesInSleepPeriod", 1)) or 1
            resumen["sueno_eficiencia"] = round(asleep / in_bed * 100, 1)
            for st in summary.get("stagesSummary", []):
                if st["type"] == "REM":
                    resumen["sueno_rem_min"] = int(st["minutes"])
                elif st["type"] == "DEEP":
                    resumen["sueno_profundo_min"] = int(st["minutes"])

    hrv_daily = snapshot.get("cardio_respiratorio", {}).get("daily-heart-rate-variability", []) or []
    if hrv_daily:
        try:
            resumen["hrv_diario"] = hrv_daily[-1]["dailyHeartRateVariability"]["rmssdMilliseconds"]
        except (KeyError, IndexError, TypeError):
            pass

    rhr = snapshot.get("cardio_respiratorio", {}).get("daily-resting-heart-rate", []) or []
    if rhr:
        try:
            resumen["frecuencia_reposo_bpm"] = rhr[-1]["dailyRestingHeartRate"]["beatsPerMinute"]
        except (KeyError, IndexError, TypeError):
            pass

    spo2 = snapshot.get("cardio_respiratorio", {}).get("daily-oxygen-saturation", []) or []
    if spo2:
        try:
            resumen["spo2_promedio_pct"] = spo2[-1]["dailyOxygenSaturation"]["averagePercentage"]
        except (KeyError, IndexError, TypeError):
            pass

    pasos_roll = snapshot.get("resumenes_diarios", {}).get("steps", {})
    try:
        resumen["pasos"] = int(pasos_roll["rollupDataPoints"][0]["steps"]["countSum"])
    except (KeyError, IndexError, TypeError):
        pass

    cal_roll = snapshot.get("resumenes_diarios", {}).get("total-calories", {})
    try:
        resumen["calorias_total"] = round(
            float(cal_roll["rollupDataPoints"][0]["totalCalories"]["caloriesKcalSum"]), 1
        )
    except (KeyError, IndexError, TypeError):
        pass

    azm = snapshot.get("resumenes_diarios", {}).get("active-zone-minutes", {})
    try:
        resumen["active_zone_min"] = int(azm["rollupDataPoints"][0]["activeZoneMinutes"]["minutesSum"])
    except (KeyError, IndexError, TypeError):
        pass

    vo2 = snapshot.get("rendimiento", {}).get("daily-vo2-max", []) or []
    if vo2:
        try:
            resumen["vo2_max"] = vo2[-1]["dailyVo2Max"]["mlPerKgPerMin"]
        except (KeyError, IndexError, TypeError):
            pass

    pesos = snapshot.get("corporales", {}).get("weight", []) or []
    if pesos:
        try:
            resumen["peso_actual_kg"] = round(pesos[-1]["weight"]["weightKilograms"], 1)
        except (KeyError, IndexError, TypeError):
            pass

    return resumen
