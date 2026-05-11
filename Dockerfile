FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m appuser
USER appuser

EXPOSE 8080

CMD exec gunicorn health_node:app -k uvicorn.workers.UvicornWorker --workers 1 --threads 8 --timeout 0 -b 0.0.0.0:$PORT
