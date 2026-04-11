"""
build_features.py
──────────────────
Joins raw ESP32 sensor readings (from Supabase) with CPCB reference AQI
to produce a labelled dataset for regression training.

Merge strategy:
  • Resample both sources to hourly bins
  • Inner join on (device_id, hour bucket)
  • Drop rows where CPCB AQI is missing

Output columns:
  pm25, co2, temperature, humidity,          ← features (X)
  pm25_raw_aqi, co2_raw_aqi,                 ← our formula output (for comparison)
  aqi_reference                               ← CPCB label (y)

Usage:
    python build_features.py \
        --supabase-url $SUPABASE_URL \
        --supabase-key $SUPABASE_SERVICE_KEY \
        --device-id   <uuid> \
        --cpcb-csv    data/cpcb_reference.csv \
        --out         data/features.csv
"""

import argparse
import sys
from pathlib import Path

import pandas as pd
import numpy  as np
import requests

# ── Inline AQI formula (mirrors computeAQI.js) ───────────────────────────────
PM25_BP = [
    (0, 30,  0,  50),
    (30, 60, 51, 100),
    (60, 90, 101, 200),
    (90, 120, 201, 300),
    (120, 250, 301, 400),
    (250, 500, 401, 500),
]

def _sub_index(val, breakpoints):
    if val is None or np.isnan(val):
        return np.nan
    val = max(0, val)
    for (c_lo, c_hi, i_lo, i_hi) in breakpoints:
        if c_lo <= val <= c_hi:
            return round(((i_hi - i_lo) / (c_hi - c_lo)) * (val - c_lo) + i_lo)
    return 500

def raw_pm25_aqi(pm25):
    return pd.Series(pm25).apply(lambda v: _sub_index(v, PM25_BP))


# ── Supabase fetch ────────────────────────────────────────────────────────────

def fetch_supabase_readings(url: str, key: str, device_id: str) -> pd.DataFrame:
    """
    Pull all sensor_readings for a device via PostgREST.
    Returns DataFrame with: reading_id, timestamp, pm25, co2, temperature, humidity
    """
    endpoint = f'{url}/rest/v1/sensor_readings'
    headers  = {
        'apikey':        key,
        'Authorization': f'Bearer {key}',
        'Accept':        'application/json',
    }
    params = {
        'device_id': f'eq.{device_id}',
        'select':    'reading_id,timestamp,pm25,co2,temperature,humidity',
        'order':     'timestamp.asc',
        'limit':     '10000',
    }

    resp = requests.get(endpoint, headers=headers, params=params, timeout=30)
    resp.raise_for_status()

    df = pd.DataFrame(resp.json())
    if df.empty:
        return df

    df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True, errors='coerce')
    df = df.dropna(subset=['timestamp'])
    return df


# ── Feature builder ───────────────────────────────────────────────────────────

def build_features(sensor_df: pd.DataFrame, cpcb_df: pd.DataFrame) -> pd.DataFrame:
    """
    Merge sensor readings with CPCB reference AQI on hourly buckets.
    Returns the labelled feature DataFrame.
    """
    # Hourly bucket column
    sensor_df = sensor_df.copy()
    cpcb_df   = cpcb_df.copy()

    # Replace pm25=0 with NaN (sensor failure stored as 0, not a real reading)
    sensor_df['pm25'] = sensor_df['pm25'].replace(0, float('nan'))


    sensor_df['hour'] = sensor_df['timestamp'].dt.floor('H')
    cpcb_df['hour']   = pd.to_datetime(cpcb_df['timestamp'], utc=True).dt.floor('H')

    # Aggregate sensor readings to hourly means
    sensor_hourly = (
        sensor_df
        .groupby('hour')[['pm25', 'co2', 'temperature', 'humidity']]
        .mean()
        .reset_index()
    )

    # Keep only AQI reference columns from CPCB
    cpcb_hourly = (
        cpcb_df
        .groupby('hour')[['aqi_reference']]
        .mean()
        .reset_index()
    )

    merged = pd.merge(sensor_hourly, cpcb_hourly, on='hour', how='inner')
    merged = merged.dropna(subset=['aqi_reference'])
    merged['aqi_reference'] = merged['aqi_reference'].round().astype(int)

    # Add our raw formula output as a comparison column
    merged['pm25_raw_aqi'] = raw_pm25_aqi(merged['pm25']).values

    merged = merged.sort_values('hour').reset_index(drop=True)
    print(f'[build_features] {len(merged)} matched hourly rows after join.')
    return merged


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Build ML feature dataset.')
    parser.add_argument('--supabase-url', required=True)
    parser.add_argument('--supabase-key', required=True, help='Service role key for read access')
    parser.add_argument('--device-id',   required=True)
    parser.add_argument('--cpcb-csv',    default='data/cpcb_reference.csv')
    parser.add_argument('--out',         default='data/features.csv')
    args = parser.parse_args()

    Path('data').mkdir(parents=True, exist_ok=True)

    # Load CPCB reference
    cpcb_path = Path(args.cpcb_csv)
    if not cpcb_path.exists():
        print(f'[build_features] CPCB CSV not found at {cpcb_path}. Run fetch_cpcb.py first.')
        sys.exit(1)

    cpcb_df = pd.read_csv(cpcb_path)
    print(f'[build_features] Loaded {len(cpcb_df)} CPCB rows.')

    # Fetch sensor readings
    print(f'[build_features] Fetching sensor readings from Supabase...')
    sensor_df = fetch_supabase_readings(args.supabase_url, args.supabase_key, args.device_id)
    if sensor_df.empty:
        print('[build_features] No sensor readings returned. Check device_id and Supabase connection.')
        sys.exit(1)
    print(f'[build_features] Loaded {len(sensor_df)} sensor rows.')

    # Build and save
    features = build_features(sensor_df, cpcb_df)
    out_path  = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    features.to_csv(out_path, index=False)
    print(f'[build_features] Features saved → {out_path}')
    print(features[['hour', 'pm25', 'co2', 'temperature', 'humidity', 'aqi_reference']].tail(5).to_string())


if __name__ == '__main__':
    main()
