import csv, json, time, requests, os
from datetime import datetime

CSV_FILE = "ENTRENOS_ALVARO_GOMEZ_RUIZ.csv"
API_URL = "https://www.googleapis.com/fitness/v1/users/me/sessions"
TOKEN = os.environ.get("FITNESS_OAUTH_TOKEN")
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

TYPE_MAP = {"WARMUP_SET": 1, "FEEDER_SET": 2, "TOP_SET": 3, "BACK_OFF_SET": 4, "NORMAL_SET": 5, "MYO_REPS_SET": 6, "DROP_SET": 7}

def main():
    sessions = {}

    if not TOKEN:
        print("[ERROR] No se detecta el Token. Ejecuta: $env:FITNESS_OAUTH_TOKEN='tu_token'")
        return

    # 1. Clasificar datos del CSV con limpieza de cabeceras
    with open(CSV_FILE, mode='r', encoding='utf-8') as f:
        # DictReader con strip para eliminar espacios en blanco en los nombres de columnas
        reader = csv.DictReader(f)
        reader.fieldnames = [field.strip().replace('"', '') for field in reader.fieldnames] #type: ignore

        for row in reader:
            # Limpiamos la fecha y el título por si tienen espacios
            d = row.get('Date', '').strip()
            title = row.get('Title', 'WORKOUT').strip()

            if not d: continue

            if d not in sessions:
                try:
                    start = int(datetime.strptime(d, "%Y-%m-%d %H:%M:%S").timestamp() * 1000)
                    sessions[d] = {'s': start, 't': title, 'sets': []}
                except ValueError:
                    continue

            compact_set = {
                "e": row.get('Exercise', 'Ejerc')[:20],
                "w": float(row.get('Weight') or 0),
                "r": int(row.get('Reps') or 0),
                "t": TYPE_MAP.get(row.get('Set Type', '').strip(), 5)
            }
            sessions[d]['sets'].append(compact_set)

    # 2. Inyección con Fragmentación (Splitting)
    print(f"[*] Iniciando carga de {len(sessions)} días de entrenamiento...")
    for date_str, data in sessions.items():
        # Bloques de 12 para seguridad total de caracteres
        chunks = [data['sets'][i:i + 12] for i in range(0, len(data['sets']), 12)]

        for i, chunk in enumerate(chunks):
            s_id = f"v14_{data['s']}_p{i+1}"
            payload = {
                "id": s_id,
                "name": f"Elite {data['t']} P{i+1}",
                "description": json.dumps({"d": chunk}, separators=(',', ':')),
                "startTimeMillis": data['s'] + (i * 1000),
                "endTimeMillis": data['s'] + 3600000,
                "version": 1,
                "application": {"name": "V14-Engine"},
                "activityType": 97
            }

            res = requests.put(f"{API_URL}/{s_id}", headers=HEADERS, json=payload)
            if res.status_code == 200:
                print(f"[OK] {date_str} - Parte {i+1} enviada.")
            else:
                print(f"[FALLO] {date_str} - P{i+1}: {res.status_code}")

if __name__ == "__main__":
    main()
