"""
fetch_cpcb.py
─────────────
Fetches reference AQI data from the CPCB (Central Pollution Control Board)
open-data API and saves it as a local CSV for use as regression labels.

CPCB Open Data Portal: https://airquality.cpcb.gov.in/AQI_India/
API endpoint used:  /api/getStationData  (public, no auth required)

Usage:
    python fetch_cpcb.py --city Nagpur --days 30 --out data/cpcb_reference.csv
"""

import argparse
import time
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
import pandas as pd

# ── CPCB station IDs for common cities ───────────────────────────────────────
# Find yours at https://airquality.cpcb.gov.in → select station → note the ID in the URL
CITY_STATION_MAP = {
    'Nagpur':   'site_1421',   # Civil Lines, Nagpur MPCB
    'Mumbai':   'site_282',
    'Delhi':    'site_208',
    'Pune':     'site_332',
    'Chennai':  'site_409',
    'Bangalore':'site_510',
}

BASE_URL = 'https://airquality.cpcb.gov.in/AQI_India/api'

# ─────────────────────────────────────────────────────────────────────────────

def fetch_station_list(city: str) -> list[dict]:
    """Return all stations matching a city name from CPCB."""
    url = f'{BASE_URL}/getStationList'
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        stations = resp.json().get('stations', [])
        return [s for s in stations if city.lower() in s.get('city', '').lower()]
    except Exception as exc:
        print(f'[fetch_cpcb] Could not fetch station list: {exc}')
        return []


def fetch_station_data(station_id: str, date_str: str) -> dict | None:
    """
    Fetch a single day's AQI data for a station.
    date_str format: 'YYYY-MM-DD'
    Returns dict with keys: timestamp, pm25, pm10, no2, aqi, category
    """
    url = f'{BASE_URL}/getStationData'
    params = {'station_id': station_id, 'date': date_str}
    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        print(f'[fetch_cpcb] {station_id} {date_str}: {exc}')
        return None


def build_reference_dataframe(station_id: str, days: int) -> pd.DataFrame:
    """
    Pull `days` days of hourly data for station_id and return a DataFrame.

    Columns: timestamp, pm25, pm10, no2, aqi_reference, category_reference
    """
    rows = []
    today = datetime.now(timezone.utc).date()

    for offset in range(days, 0, -1):
        date = today - timedelta(days=offset)
        date_str = date.strftime('%Y-%m-%d')
        data = fetch_station_data(station_id, date_str)

        if data is None:
            continue

        # CPCB returns a list of hourly records under 'data' key
        hourly = data.get('data', [])
        for record in hourly:
            rows.append({
                'timestamp':          record.get('timestamp'),
                'pm25':               _safe_float(record.get('PM2.5')),
                'pm10':               _safe_float(record.get('PM10')),
                'no2':                _safe_float(record.get('NO2')),
                'aqi_reference':      _safe_int(record.get('AQI')),
                'category_reference': record.get('AQI_Category', ''),
            })

        time.sleep(0.3)  # be polite to the API

    df = pd.DataFrame(rows)
    if df.empty:
        return df

    df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True, errors='coerce')
    df = df.dropna(subset=['timestamp', 'aqi_reference'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    return df


def _safe_float(val, default=None):
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _safe_int(val, default=None):
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return default


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Fetch CPCB reference AQI data.')
    parser.add_argument('--city',    default='Nagpur', help='City name (default: Nagpur)')
    parser.add_argument('--station', default=None,     help='Override station ID directly')
    parser.add_argument('--days',    type=int, default=30, help='Number of past days to fetch')
    parser.add_argument('--out',     default='data/cpcb_reference.csv', help='Output CSV path')
    args = parser.parse_args()

    station_id = args.station or CITY_STATION_MAP.get(args.city)
    if not station_id:
        print(f'[fetch_cpcb] Unknown city "{args.city}". Use --station to specify ID directly.')
        print(f'Known cities: {", ".join(CITY_STATION_MAP.keys())}')
        return

    print(f'[fetch_cpcb] Fetching {args.days} days of data for station {station_id} ({args.city})...')

    df = build_reference_dataframe(station_id, args.days)

    if df.empty:
        print('[fetch_cpcb] No data returned — check station ID or try a different city.')
        return

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    print(f'[fetch_cpcb] Saved {len(df)} rows → {out_path}')
    print(df.tail(5).to_string())


if __name__ == '__main__':
    main()
