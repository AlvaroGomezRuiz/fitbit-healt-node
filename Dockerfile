FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TZ=Europe/Madrid

RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

# El CSV histórico se sube desde local (p. ej. scripts/actualizar_contexto_drive.py).
# El contenedor lo lee desde Drive vía descargar_csv_contexto(),
# por eso NO se empaqueta dentro de la imagen.

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

CMD exec gunicorn src.health_node:app \
    -k uvicorn.workers.UvicornWorker \
    --workers 1 \
    --threads 8 \
    --timeout 300 \
    -b 0.0.0.0:${PORT:-8080}
