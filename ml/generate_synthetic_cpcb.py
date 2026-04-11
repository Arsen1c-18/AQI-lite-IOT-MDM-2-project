"""
generate_synthetic_cpcb.py
Generates synthetic CPCB reference data for Nagpur (80–180 AQI range).
Used as fallback when the CPCB API is unreachable.
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from pathlib import Path

hours = pd.date_range(
    start=datetime.now(timezone.utc) - timedelta(days=30),
    end=datetime.now(timezone.utc),
    freq='h'
)
np.random.seed(42)

aqi = np.clip(
    100 + np.random.normal(0, 25, len(hours)) +
    10 * np.sin(np.arange(len(hours)) * 2 * np.pi / 24),
    50, 200
).astype(int)

# Back-calculate pm25 from CPCB AQI using inverse linear breakpoint formula
# AQI 51–100 → PM2.5 30–60 µg/m³
def aqi_to_pm25(a):
    if a <= 50:
        return round(a / 50 * 30, 2)
    elif a <= 100:
        return round(30 + (a - 50) / 50 * 30, 2)
    elif a <= 200:
        return round(60 + (a - 100) / 100 * 30, 2)
    else:
        return round(90 + (a - 200) / 100 * 30, 2)

pm25_vals = [aqi_to_pm25(a) for a in aqi]

cats = pd.cut(
    aqi,
    bins=[0, 50, 100, 200, 300, 400, 500],
    labels=['Good', 'Satisfactory', 'Moderate', 'Poor', 'Very Poor', 'Severe']
).astype(str)

df = pd.DataFrame({
    'timestamp':          hours.strftime('%Y-%m-%dT%H:%M:%SZ'),
    'pm25':               pm25_vals,
    'aqi_reference':      aqi,
    'category_reference': cats,
})

Path('data').mkdir(parents=True, exist_ok=True)
out = Path('data/cpcb_reference.csv')
df.to_csv(out, index=False)
print(f'[synthetic] Generated {len(df)} rows -> {out}')
print(f'  AQI range: {aqi.min()}–{aqi.max()} (mean: {aqi.mean():.1f})')
print(f'  Date range: {df["timestamp"].iloc[0]}  →  {df["timestamp"].iloc[-1]}')
print('\nFirst 3 rows:')
print(df[['timestamp', 'pm25', 'aqi_reference']].head(3).to_string(index=False))
print('\nLast 3 rows:')
print(df[['timestamp', 'pm25', 'aqi_reference']].tail(3).to_string(index=False))
