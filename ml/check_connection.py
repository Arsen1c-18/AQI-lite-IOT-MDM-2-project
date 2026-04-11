import os
from pathlib import Path

env_file = Path(__file__).parent / '.env'
for line in env_file.read_text().splitlines():
    line = line.strip()
    if line and '=' in line and not line.startswith('#'):
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

import requests

url = os.environ['SUPABASE_URL']
key = os.environ['SUPABASE_SERVICE_KEY']
device_id = os.environ['DEVICE_ID']

resp = requests.get(
    f'{url}/rest/v1/sensor_readings',
    headers={
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Prefer': 'count=exact'
    },
    params={
        'device_id': f'eq.{device_id}',
        'select': 'reading_id,timestamp,pm25,co2',
        'order': 'timestamp.desc',
        'limit': '5'
    },
    timeout=15
)

print(f'HTTP {resp.status_code}')
print(f'Content-Range: {resp.headers.get("Content-Range", "not returned")}')
rows = resp.json()
if isinstance(rows, list):
    print(f'Rows returned: {len(rows)}')
    for r in rows:
        print(f'  reading_id={r["reading_id"]}  ts={r["timestamp"]}  pm25={r["pm25"]}  co2={r["co2"]}')
else:
    print(f'Error response: {rows}')
