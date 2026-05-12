"""
FastAPI entrypoint para Cloud Run.

Endpoints:
  GET  /health                        Liveness probe (NO /healthz: el GFE de
                                       Google reserva esa ruta)
  POST /cron/pre_entreno              Cloud Scheduler 08:50 Madrid
  POST /cron/resumen_noche            Cloud Scheduler 23:00 Madrid
  POST /cron/purgar_health_raw        Cloud Scheduler semanal (retención 120d)
  POST /webhook/lyfta_workout         Atajo iOS sube TXT del entreno
  POST /webhook/health_push           Push de Google Health API (suscripción)
  POST /admin/seed                    Bootstrap: CSV + PERFIL_ATLETA.md
"""

from __future__ import annotations

import datetime
import io
import os

import uvicorn
from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

from .engines.brain_engine import (
    extraer_metadatos_entreno,
    generar_perfil_atleta_desde_csv,
    generar_post_entreno,
    generar_pre_entreno,
    generar_resumen_noche,
)
from .engines.drive_engine import (
    purgar_health_raw_antiguos,
    subir_csv_contexto,
    volcar_archivo_raw,
    volcar_log_sistema,
)

app = FastAPI(title="Fitbit Air - Google Health Node", version="2.0.0")

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")


def _decodificar(content: bytes, ext: str) -> str:
    if ext == "pdf":
        if PdfReader is None:
            return "Error: pypdf no disponible."
        try:
            reader = PdfReader(io.BytesIO(content))
            return "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as e:
            return f"Fallo PDF: {e}"
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("latin-1", errors="replace")


# ──────────────────────────────────────────────────────────────────────────
# HEALTH
# ──────────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"service": "fitbit-air-health-node", "version": "2.0.0", "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.datetime.utcnow().isoformat()}


# ──────────────────────────────────────────────────────────────────────────
# CRONS (Cloud Scheduler)
# ──────────────────────────────────────────────────────────────────────────

@app.post("/cron/pre_entreno")
async def cron_pre_entreno():
    """
    Ejecución SÍNCRONA: Cloud Run apaga la CPU al devolver respuesta,
    matando tasks de fondo. Cloud Scheduler tolera hasta 30 min de espera.
    """
    ts_inicio = datetime.datetime.utcnow().isoformat()
    try:
        ok = generar_pre_entreno()
    except Exception as e:
        volcar_log_sistema(
            f"[ERROR PRE_ENTRENO] {type(e).__name__}: {e}",
            f"ERR_PRE_{datetime.datetime.utcnow().strftime('%H%M%S')}.txt",
        )
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
    return {
        "status": "ok" if ok else "fallo",
        "ts_inicio": ts_inicio,
        "ts_fin": datetime.datetime.utcnow().isoformat(),
    }


@app.post("/cron/resumen_noche")
async def cron_resumen_noche():
    ts_inicio = datetime.datetime.utcnow().isoformat()
    try:
        ok = generar_resumen_noche()
    except Exception as e:
        volcar_log_sistema(
            f"[ERROR RESUMEN_NOCHE] {type(e).__name__}: {e}",
            f"ERR_NOCHE_{datetime.datetime.utcnow().strftime('%H%M%S')}.txt",
        )
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
    return {
        "status": "ok" if ok else "fallo",
        "ts_inicio": ts_inicio,
        "ts_fin": datetime.datetime.utcnow().isoformat(),
    }


@app.post("/cron/purgar_health_raw")
async def cron_purgar():
    borrados = purgar_health_raw_antiguos()
    volcar_log_sistema(
        f"[RETENCION] {borrados} JSON crudos eliminados (> 120 días).",
        f"INFO_RETENCION_{datetime.datetime.utcnow().strftime('%H%M%S')}.txt",
    )
    return {"status": "ok", "borrados": borrados}


# ──────────────────────────────────────────────────────────────────────────
# WEBHOOKS
# ──────────────────────────────────────────────────────────────────────────

@app.post("/webhook/lyfta_workout")
async def webhook_lyfta(file: UploadFile = File(...)):
    """
    Ejecución SÍNCRONA: el atajo iOS de Lyfta puede esperar hasta 2 min.
    El POST_ENTRENO incluye llamada LLM (15-60s con cascada).
    """
    content = await file.read()
    filename = file.filename or "entreno.txt"
    ext = filename.split(".")[-1].lower() if "." in filename else "txt"
    raw_text = _decodificar(content, ext)
    ts_inicio = datetime.datetime.utcnow().isoformat()

    try:
        fecha_dt, tipo = extraer_metadatos_entreno(raw_text)
        fid_raw = volcar_archivo_raw(content, ext, fecha_dt, tipo)
        ok_reporte = generar_post_entreno(raw_text)
    except Exception as e:
        volcar_log_sistema(
            f"[ERROR PIPELINE LYFTA] {type(e).__name__}: {e}",
            f"ERR_LYFTA_{datetime.datetime.utcnow().strftime('%H%M%S')}.txt",
        )
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")

    return {
        "status": "ok" if ok_reporte else "raw_guardado_reporte_fallido",
        "bytes": len(content),
        "fecha": fecha_dt.isoformat(),
        "tipo": tipo,
        "file_id_raw": fid_raw,
        "ts_inicio": ts_inicio,
        "ts_fin": datetime.datetime.utcnow().isoformat(),
    }


@app.post("/webhook/health_push")
async def webhook_health_push(request: Request):
    """
    Receptor de notificaciones push de Google Health API.
    Solo loggea. El snapshot se reextrae en cada cron.
    Síncrono: respuesta inmediata tras escribir log.
    """
    try:
        payload = await request.json()
    except Exception:
        payload = {"raw": (await request.body()).decode("utf-8", errors="replace")[:500]}

    volcar_log_sistema(
        f"[HEALTH PUSH] {payload}",
        f"INFO_HEALTH_PUSH_{datetime.datetime.utcnow().strftime('%H%M%S')}.txt",
    )
    return {"status": "push_recibido"}


# ──────────────────────────────────────────────────────────────────────────
# ADMIN (bootstrap)
# ──────────────────────────────────────────────────────────────────────────

@app.post("/admin/seed")
async def admin_seed(x_admin_token: str | None = Header(default=None, alias="X-Admin-Token")):
    """
    Regenera PERFIL_ATLETA.md a partir del CSV ya presente en Drive
    (00_CONTEXTO_HISTORICO/). El CSV debe haberse subido UNA vez con
    `python -m scripts.seed_drive --upload-csv` desde local.

    Si en el futuro hay un CSV nuevo en el filesystem del contenedor
    (env var CSV_HISTORICO_PATH), también se reincorpora a Drive antes
    de regenerar el perfil.

    Protegido por header X-Admin-Token (env ADMIN_TOKEN).
    """
    if not ADMIN_TOKEN or x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Token inválido.")

    fid_csv: str | None = None
    csv_path = os.environ.get("CSV_HISTORICO_PATH", "")
    if csv_path and os.path.exists(csv_path):
        fid_csv = subir_csv_contexto(csv_path)

    ok_perfil = generar_perfil_atleta_desde_csv()

    return {
        "csv_file_id_local_subido": fid_csv,
        "perfil_generado": ok_perfil,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
