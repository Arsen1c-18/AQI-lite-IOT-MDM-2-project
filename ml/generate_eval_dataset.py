import pandas as pd
import numpy as np

# Load our previously matched feature dataset
df = pd.read_csv("data/features.csv")

# AQI Breakpoints (matching index.ts)
PM25_BREAKPOINTS = [
    (0, 30, 0, 50),
    (30, 60, 51, 100),
    (60, 90, 101, 200),
    (90, 120, 201, 300),
    (120, 250, 301, 400),
    (250, 500, 401, 500),
]

CO2_BREAKPOINTS = [
    (0, 400, 0, 50),
    (400, 600, 51, 100),
    (600, 1000, 101, 200),
    (1000, 1500, 201, 300),
    (1500, 2500, 301, 400),
    (2500, 5000, 401, 500),
]

def linear_sub_index(c, breakpoints):
    if pd.isna(c): return np.nan
    c = max(0, c)
    for c_lo, c_hi, i_lo, i_hi in breakpoints:
        if c_lo <= c <= c_hi:
            return round(((i_hi - i_lo) / (c_hi - c_lo)) * (c - c_lo) + i_lo)
    return 500

def compute_aqi(pm25, co2):
    pm_idx = linear_sub_index(pm25, PM25_BREAKPOINTS)
    co2_idx = linear_sub_index(co2, CO2_BREAKPOINTS)
    if pd.isna(pm_idx) and pd.isna(co2_idx):
        return np.nan
    return max(val for val in [pm_idx, co2_idx] if not pd.isna(val))

def hybrid_correct_pm25(pm25, humidity, temperature):
    if pd.isna(pm25): return np.nan
    corrected = pm25
    if not pd.isna(humidity):
        corrected *= 1 - 0.02 * (humidity - 50) / 50
    if not pd.isna(temperature):
        corrected *= 1 + 0.01 * (temperature - 25) / 25
    return max(0, round(corrected, 2))

# Calculate columns exactly like the Edge Function
raw_aqi = []
hybrid_aqi = []
for _, row in df.iterrows():
    # Filter unrealistic CO2 values
    co2 = row['co2'] if pd.notna(row['co2']) and row['co2'] <= 2000 else np.nan
    
    r_aqi = compute_aqi(row['pm25'], co2)
    
    corr_pm25 = hybrid_correct_pm25(row['pm25'], row['humidity'], row['temperature'])
    h_aqi = compute_aqi(corr_pm25, co2)
    
    raw_aqi.append(r_aqi)
    hybrid_aqi.append(h_aqi)

# Create the final evaluation dataset
eval_df = pd.DataFrame({
    'timestamp': df['hour'],
    'raw_aqi': raw_aqi,
    'hybrid_aqi': hybrid_aqi,
    'cpcb_aqi': df['aqi_reference']
})

eval_df = eval_df.dropna(subset=["raw_aqi", "hybrid_aqi", "cpcb_aqi"])
eval_df.to_csv("data/eval_dataset.csv", index=False)
print(f"Generated data/eval_dataset.csv with {len(eval_df)} rows")
