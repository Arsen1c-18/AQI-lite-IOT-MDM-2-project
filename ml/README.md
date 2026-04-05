# AQI Lite — ML Calibration Pipeline

Low-cost sensors (PMS5003 for PM2.5, MH-Z19B for CO₂) drift with temperature,
humidity, and age. This pipeline corrects raw readings by training a Ridge
regression model against official CPCB reference AQI values.

---

## Folder layout

```
ml/
├── fetch_cpcb.py          # Step 1 — pull CPCB reference data
├── build_features.py      # Step 2 — merge with ESP32 readings from Supabase
├── train_calibration.py   # Step 3 — train + save model, backfill DB
├── requirements.txt
├── data/                  # created automatically
│   ├── cpcb_reference.csv
│   └── features.csv
└── models/                # created automatically
    ├── calibration_ridge-v1.joblib
    └── calibration_ridge-v1_meta.json
```

---

## Setup

```bash
cd ml
pip install -r requirements.txt
```

---

## Step 1 — Fetch CPCB reference AQI

```bash
python fetch_cpcb.py --city Nagpur --days 30 --out data/cpcb_reference.csv
```

`--city` options: Nagpur, Mumbai, Delhi, Pune, Chennai, Bangalore  
Use `--station site_XXXX` to override with a specific CPCB station ID  
(find IDs at https://airquality.cpcb.gov.in)

---

## Step 2 — Build feature dataset

Merges your ESP32 sensor readings (from Supabase) with CPCB reference AQI
on hourly buckets.

```bash
python build_features.py \
  --supabase-url  https://your-project.supabase.co \
  --supabase-key  <service_role_key> \
  --device-id     <your-device-uuid> \
  --cpcb-csv      data/cpcb_reference.csv \
  --out           data/features.csv
```

> Use the **service role key** (not anon) so the query bypasses RLS.  
> You need at least **20 matched hourly rows** to train a meaningful model.

---

## Step 3 — Train the model

```bash
python train_calibration.py train --features data/features.csv
```

Output:
```
[train] Evaluation on 48 test samples:
  MAE  = 8.31  AQI units
  RMSE = 11.47 AQI units
  R²   = 0.891

[train] Feature coefficients (Ridge):
  pm25           : +0.8412
  co2            : +0.1203
  temperature    : -0.0541
  humidity       : -0.0318
```

Model is saved to `models/calibration_ridge-v1.joblib`.

---

## Step 4 — Back-fill Supabase with calibrated AQI

Updates all `aqi_results` rows where `calibrated_aqi IS NULL`:

```bash
python train_calibration.py backfill \
  --supabase-url https://your-project.supabase.co \
  --supabase-key <service_role_key> \
  --device-id    <your-device-uuid>
```

---

## Step 5 — Use in production (ESP32 → Edge Function)

Option A: **Run calibration on the server** (recommended)  
Deploy `train_calibration.py predict` logic as a Supabase Edge Function  
(Deno) or a small Python Lambda. The ESP32 still POSTs raw values; the
Edge Function computes `calculated_aqi` (formula) and `calibrated_aqi`
(model) before inserting into Supabase.

Option B: **Pre-load model on device** (not recommended for ESP32)  
The Ridge model is just a dot product: you can extract coefficients from
`calibration_ridge-v1_meta.json` and implement the scaled dot product in
Arduino C++ if flash space allows.

---

## One-shot prediction test

```bash
python train_calibration.py predict \
  --pm25 45.2 --co2 780 --temperature 28.1 --humidity 63
# Calibrated AQI: 127
```

---

## Re-training

Re-run Steps 1–3 as more co-located data accumulates. A new `_v2` model file
can be added without breaking the existing one — just update `MODEL_VERSION`
in `train_calibration.py`.
