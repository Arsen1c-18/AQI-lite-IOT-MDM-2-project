"""
train_calibration.py
─────────────────────
Trains a Ridge regression model to map raw sensor features → CPCB-calibrated AQI.

Why Ridge over plain Linear Regression?
  • PM2.5, CO2, temperature, and humidity are mildly correlated → Ridge's
    L2 regularisation prevents coefficient blow-up with correlated inputs.
  • Simple enough to inspect and explain; no black-box concerns.

Pipeline:
  1. Load features.csv (output of build_features.py)
  2. Impute missing values (median), scale features (StandardScaler)
  3. Train Ridge on 80% of data, validate on 20%
  4. Report MAE, RMSE, R²
  5. Save model + scaler as models/calibration_ridge_v1.joblib

Inference:
  from train_calibration import load_model, predict_calibrated_aqi
  model = load_model()
  aqi   = predict_calibrated_aqi(model, pm25=45.2, co2=680, temperature=28.1, humidity=65)

Usage (training):
    python train_calibration.py --features data/features.csv
"""

import argparse
import sys
import json
from pathlib import Path
from datetime import datetime, timezone

import numpy  as np
import pandas as pd
import joblib

from sklearn.linear_model    import Ridge
from sklearn.pipeline        import Pipeline
from sklearn.preprocessing   import StandardScaler
from sklearn.impute          import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.metrics         import mean_absolute_error, mean_squared_error, r2_score

# ── Constants ─────────────────────────────────────────────────────────────────
FEATURE_COLS  = ['pm25', 'co2', 'temperature', 'humidity']
TARGET_COL    = 'aqi_reference'
MODEL_VERSION = 'ridge-v1'
MODEL_DIR     = Path('models')
MODEL_PATH    = MODEL_DIR / f'calibration_{MODEL_VERSION}.joblib'
METADATA_PATH = MODEL_DIR / f'calibration_{MODEL_VERSION}_meta.json'

# ── Training ──────────────────────────────────────────────────────────────────

def train(features_csv: str, alpha: float = 1.0, test_size: float = 0.2):
    df = pd.read_csv(features_csv)
    print(f'[train] Loaded {len(df)} rows from {features_csv}')

    # Require at least 20 samples for a meaningful model
    if len(df) < 20:
        print('[train] Not enough data. Collect more co-located readings first.')
        sys.exit(1)

    X = df[FEATURE_COLS]
    y = df[TARGET_COL].astype(float)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42
    )

    # Pipeline: impute → scale → Ridge
    model = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler',  StandardScaler()),
        ('ridge',   Ridge(alpha=alpha)),
    ])

    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    mae  = mean_absolute_error(y_test, y_pred)
    rmse = mean_squared_error(y_test, y_pred) ** 0.5
    r2   = r2_score(y_test, y_pred)

    print(f'\n[train] Evaluation on {len(X_test)} test samples:')
    print(f'  MAE  = {mae:.2f}  AQI units')
    print(f'  RMSE = {rmse:.2f}  AQI units')
    print(f'  R²   = {r2:.4f}')

    # Feature importance (Ridge coefficients after scaling)
    coefs = model.named_steps['ridge'].coef_
    print('\n[train] Feature coefficients (Ridge):')
    for feat, coef in zip(FEATURE_COLS, coefs):
        print(f'  {feat:15s}: {coef:+.4f}')

    # Save model
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f'\n[train] Model saved → {MODEL_PATH}')

    # Save metadata
    scaler  = model.named_steps['scaler']
    imputer = model.named_steps['imputer']

    scaler_mean     = dict(zip(FEATURE_COLS, scaler.mean_.tolist()))
    scaler_scale    = dict(zip(FEATURE_COLS, scaler.scale_.tolist()))
    imputer_medians = dict(zip(FEATURE_COLS, imputer.statistics_.tolist()))

    metadata = {
        'version':      MODEL_VERSION,
        'trained_at':   datetime.now(timezone.utc).isoformat(),
        'n_train':      len(X_train),
        'n_test':       len(X_test),
        'alpha':        alpha,
        'features':     FEATURE_COLS,
        'mae':          round(mae, 3),
        'rmse':         round(rmse, 3),
        'r2':           round(r2, 4),
        'coefficients': dict(zip(FEATURE_COLS, [round(c, 4) for c in coefs])),
        'intercept':    round(float(model.named_steps['ridge'].intercept_), 4),
        'scaler': {
            'mean':  {k: round(v, 6) for k, v in scaler_mean.items()},
            'scale': {k: round(v, 6) for k, v in scaler_scale.items()},
        },
        'imputer_medians': {k: round(v, 6) for k, v in imputer_medians.items()},
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2))
    print(f'[train] Metadata saved → {METADATA_PATH}')

    edge_secret = {
        "version":      MODEL_VERSION,
        "features":     FEATURE_COLS,
        "coefficients": metadata["coefficients"],
        "intercept":    metadata["intercept"],
        "scaler":       metadata["scaler"],
        "imputer_medians": metadata["imputer_medians"]
    }
    SECRET_PATH = MODEL_DIR / 'edge_function_secret.json'
    SECRET_PATH.write_text(json.dumps(edge_secret, indent=2))
    print(f'\n[train] Run the following command to update Edge Function:')
    print(f'  supabase secrets set CALIBRATION_MODEL_JSON="$(cat {SECRET_PATH})"')

    return model, metadata


# ── Inference helpers ─────────────────────────────────────────────────────────

def load_model() -> Pipeline:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f'Model not found at {MODEL_PATH}. Run train_calibration.py first.'
        )
    return joblib.load(MODEL_PATH)


def predict_calibrated_aqi(
    model:       Pipeline,
    pm25:        float | None = None,
    co2:         float | None = None,
    temperature: float | None = None,
    humidity:    float | None = None,
) -> int:
    """
    Predict calibrated AQI from raw sensor values.
    Missing features are imputed by the pipeline.

    Returns: calibrated_aqi (int, clamped 0–500)
    """
    X = pd.DataFrame([{
        'pm25':        pm25,
        'co2':         co2,
        'temperature': temperature,
        'humidity':    humidity,
    }])
    raw = float(model.predict(X)[0])
    return int(np.clip(round(raw), 0, 500))


# ── Back-fill Supabase ────────────────────────────────────────────────────────

def backfill_supabase(supabase_url: str, supabase_key: str, device_id: str):
    """
    Reads all aqi_results rows where calibrated_aqi IS NULL for this device,
    computes the calibrated value, and PATCHes each row.

    Requires: pip install requests
    """
    import requests

    headers = {
        'apikey':        supabase_key,
        'Authorization': f'Bearer {supabase_key}',
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
    }

    model = load_model()

    # Fetch uncalibrated rows with their linked sensor readings
    resp = requests.get(
        f'{supabase_url}/rest/v1/aqi_results',
        headers=headers,
        params={
            'device_id':     f'eq.{device_id}',
            'calibrated_aqi': 'is.null',
            'select':        'result_id,reading_id',
            'limit':         '500',
        },
        timeout=30,
    )
    resp.raise_for_status()
    rows = resp.json()
    print(f'[backfill] {len(rows)} uncalibrated rows found.')

    for row in rows:
        # Fetch sensor values
        sr_resp = requests.get(
            f'{supabase_url}/rest/v1/sensor_readings',
            headers=headers,
            params={
                'reading_id': f'eq.{row["reading_id"]}',
                'select':     'pm25,co2,temperature,humidity',
            },
            timeout=15,
        )
        sr_resp.raise_for_status()
        sr_data = sr_resp.json()
        if not sr_data:
            continue
        sr = sr_data[0]

        calibrated = predict_calibrated_aqi(
            model,
            pm25        = sr.get('pm25'),
            co2         = sr.get('co2'),
            temperature = sr.get('temperature'),
            humidity    = sr.get('humidity'),
        )

        # PATCH the aqi_results row
        patch_resp = requests.patch(
            f'{supabase_url}/rest/v1/aqi_results',
            headers=headers,
            params={'result_id': f'eq.{row["result_id"]}'},
            json={
                'calibrated_aqi':              calibrated,
                'calibration_model_version':   MODEL_VERSION,
            },
            timeout=15,
        )
        patch_resp.raise_for_status()

    print(f'[backfill] Done — {len(rows)} rows updated.')


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Train AQI calibration model.')
    sub = parser.add_subparsers(dest='cmd', required=True)

    # train
    t = sub.add_parser('train', help='Train the model from features.csv')
    t.add_argument('--features', default='data/features.csv')
    t.add_argument('--alpha',    type=float, default=1.0, help='Ridge alpha (regularisation strength)')

    # predict (single-shot test)
    p = sub.add_parser('predict', help='Run a one-shot prediction')
    p.add_argument('--pm25',        type=float)
    p.add_argument('--co2',         type=float)
    p.add_argument('--temperature', type=float)
    p.add_argument('--humidity',    type=float)

    # backfill
    b = sub.add_parser('backfill', help='Back-fill calibrated_aqi in Supabase')
    b.add_argument('--supabase-url', required=True)
    b.add_argument('--supabase-key', required=True)
    b.add_argument('--device-id',   required=True)

    args = parser.parse_args()

    if args.cmd == 'train':
        train(args.features, alpha=args.alpha)

    elif args.cmd == 'predict':
        model = load_model()
        result = predict_calibrated_aqi(
            model,
            pm25        = args.pm25,
            co2         = args.co2,
            temperature = args.temperature,
            humidity    = args.humidity,
        )
        print(f'Calibrated AQI: {result}')

    elif args.cmd == 'backfill':
        backfill_supabase(args.supabase_url, args.supabase_key, args.device_id)


if __name__ == '__main__':
    main()
