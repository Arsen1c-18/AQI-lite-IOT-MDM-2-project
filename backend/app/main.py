"""
AQI Lite — FastAPI Backend
Queries sensor_readings directly since aqi_results is unused in the live DB.
AQI is computed here using CPCB PM2.5 linear-interpolation breakpoints.
ML predictions are pulled from ml_predictions table when available.
A /predict endpoint also supports live Ridge inference from the saved joblib model.
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .models import (
    DeviceInfoResponse,
    HistoricalDataPoint,
    HistoricalDataResponse,
    LatestDataResponse,
)
from .supabase_service import get_supabase_client, maybe_single_row

settings = get_settings()
app = FastAPI(title="AQI Lite Backend", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── CPCB AQI calculator ──────────────────────────────────────────────────────
# PM2.5 breakpoints (µg/m³) → AQI breakpoints
_PM25_BP = [
    (0.0,   30.0,   0,   50),    # Good
    (30.0,  60.0,   51,  100),   # Satisfactory
    (60.0,  90.0,   101, 200),   # Moderate
    (90.0,  120.0,  201, 300),   # Poor
    (120.0, 250.0,  301, 400),   # Very Poor
    (250.0, 500.0,  401, 500),   # Severe
]

_CATEGORIES = [
    (0,   50,  "Good",         "PM2.5"),
    (51,  100, "Satisfactory", "PM2.5"),
    (101, 200, "Moderate",     "PM2.5"),
    (201, 300, "Poor",         "PM2.5"),
    (301, 400, "Very Poor",    "PM2.5"),
    (401, 500, "Severe",       "PM2.5"),
]


def pm25_to_aqi(pm25: Optional[float]) -> Optional[int]:
    """Linear interpolation CPCB AQI from PM2.5 µg/m³."""
    if pm25 is None:
        return None
    pm25 = max(0.0, float(pm25))
    for (lo_c, hi_c, lo_i, hi_i) in _PM25_BP:
        if pm25 <= hi_c:
            aqi = lo_i + (pm25 - lo_c) / (hi_c - lo_c) * (hi_i - lo_i)
            return int(round(aqi))
    return 500  # cap at Severe


def aqi_to_category(aqi: Optional[int]) -> str:
    if aqi is None:
        return "Unknown"
    for (lo, hi, cat, _) in _CATEGORIES:
        if lo <= aqi <= hi:
            return cat
    return "Severe" if aqi and aqi > 400 else "Unknown"


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _enrich_reading(row: dict, ml_map: dict | None = None) -> dict:
    """
    Compute AQI from PM2.5 for a sensor_readings row.
    Optionally overlay ml_predictions if available.
    """
    pm25 = row.get("pm25")
    raw_aqi = pm25_to_aqi(pm25)
    category = aqi_to_category(raw_aqi)

    ml = (ml_map or {}).get(row.get("reading_id"))
    ml_aqi = int(ml["predicted_aqi"]) if ml and ml.get("predicted_aqi") is not None else None
    final_aqi = ml_aqi if ml_aqi is not None else raw_aqi

    return {
        "raw_aqi": raw_aqi,
        "ml_aqi": ml_aqi,
        "final_aqi": final_aqi,
        "category": ml.get("predicted_category", category) if ml else category,
        "pollution_source": ml.get("pollution_source") if ml else None,
        "confidence_score": ml.get("confidence_score") if ml else None,
    }


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/devices/{device_id}/latest")
def get_latest(device_id: str) -> dict:
    supabase = get_supabase_client()

    # Latest sensor reading
    sensor_resp = (
        supabase.table("sensor_readings")
        .select("reading_id, device_id, pm25, co2, temperature, humidity, timestamp")
        .eq("device_id", device_id)
        .order("timestamp", desc=True)
        .limit(1)
        .execute()
    )
    sensor_row = maybe_single_row(sensor_resp.data or [])
    if not sensor_row:
        raise HTTPException(status_code=404, detail="No readings found for this device.")

    # Try to get ML prediction for this reading
    ml_map: dict = {}
    rid = sensor_row.get("reading_id")
    if rid is not None:
        ml_resp = (
            supabase.table("ml_predictions")
            .select("reading_id, predicted_aqi, predicted_category, pollution_source, confidence_score")
            .eq("reading_id", rid)
            .limit(1)
            .execute()
        )
        ml_row = maybe_single_row(ml_resp.data or [])
        if ml_row:
            ml_map[rid] = ml_row

    enriched = _enrich_reading(sensor_row, ml_map)

    # Device metadata
    device_resp = (
        supabase.table("devices")
        .select("device_name")
        .eq("device_id", device_id)
        .limit(1)
        .execute()
    )
    device_row = maybe_single_row(device_resp.data or []) or {}

    # Device status
    status_resp = (
        supabase.table("device_status_logs")
        .select("status, last_seen")
        .eq("device_id", device_id)
        .order("last_seen", desc=True)
        .limit(1)
        .execute()
    )
    status_row = maybe_single_row(status_resp.data or {})

    last_seen = (status_row or {}).get("last_seen") or sensor_row["timestamp"]

    latest = LatestDataResponse(
        aqi=enriched["final_aqi"],
        raw_aqi=enriched["raw_aqi"],
        hybrid_aqi=enriched["ml_aqi"],
        category=enriched["category"],
        main_pollutant="PM2.5",
        calibration_model="ml-v1" if enriched["ml_aqi"] is not None else "cpcb-formula",
        pm25=sensor_row.get("pm25"),
        corrected_pm25=sensor_row.get("pm25"),   # no separate corrected value
        co2=sensor_row.get("co2"),
        temperature=sensor_row.get("temperature"),
        humidity=sensor_row.get("humidity"),
        timestamp=sensor_row["timestamp"],
    )

    device_info = DeviceInfoResponse(
        device_name=device_row.get("device_name") or "AQI Lite Node",
        last_seen=last_seen,
        status=(status_row or {}).get("status") or "unknown",
    )

    return {"latestData": latest.model_dump(), "deviceInfo": device_info.model_dump()}


@app.get("/api/devices/{device_id}/history", response_model=HistoricalDataResponse)
def get_history(
    device_id: str,
    hours: int = Query(default=settings.default_history_hours, ge=1, le=720),
) -> HistoricalDataResponse:
    supabase = get_supabase_client()

    # Use a wide window: look both backward AND forward to handle future-dated inserts
    now = datetime.now(timezone.utc)
    since = (now - timedelta(hours=hours)).isoformat()
    until = (now + timedelta(hours=48)).isoformat()   # catch future-dated rows

    sensor_resp = (
        supabase.table("sensor_readings")
        .select("reading_id, pm25, co2, temperature, humidity, timestamp")
        .eq("device_id", device_id)
        .gte("timestamp", since)
        .lte("timestamp", until)
        .order("timestamp", desc=False)
        .execute()
    )
    rows = sensor_resp.data or []

    if not rows:
        # Fallback: return the last `hours` worth regardless of timestamp
        sensor_resp2 = (
            supabase.table("sensor_readings")
            .select("reading_id, pm25, co2, temperature, humidity, timestamp")
            .eq("device_id", device_id)
            .order("timestamp", desc=True)
            .limit(hours)           # 1 row per hour as approximation
            .execute()
        )
        rows = list(reversed(sensor_resp2.data or []))

    if not rows:
        return HistoricalDataResponse(data=[])

    # Batch-fetch ML predictions for all reading_ids
    reading_ids = [r.get("reading_id") for r in rows if r.get("reading_id") is not None]
    ml_map: dict = {}
    if reading_ids:
        ml_resp = (
            supabase.table("ml_predictions")
            .select("reading_id, predicted_aqi, predicted_category, pollution_source, confidence_score")
            .in_("reading_id", reading_ids)
            .execute()
        )
        for ml in (ml_resp.data or []):
            if ml.get("reading_id") is not None:
                ml_map[ml["reading_id"]] = ml

    points = []
    for row in rows:
        enriched = _enrich_reading(row, ml_map)
        points.append(
            HistoricalDataPoint(
                timestamp=row["timestamp"],
                final_aqi=enriched["final_aqi"],
                raw_aqi=enriched["raw_aqi"],
                corrected_pm25=row.get("pm25"),
                calibration_model="ml-v1" if enriched["ml_aqi"] is not None else "cpcb-formula",
                pm25=row.get("pm25"),
                co2=row.get("co2"),
                temperature=row.get("temperature"),
                humidity=row.get("humidity"),
            )
        )

    return HistoricalDataResponse(data=points)


# ─── Live ML inference endpoint ───────────────────────────────────────────────

_ML_DIR    = Path(__file__).resolve().parent.parent.parent / "ml"
_ML_MODEL  = _ML_DIR / "models" / "calibration_ridge-v1.joblib"
_ML_META   = _ML_DIR / "models" / "calibration_ridge-v1_meta.json"


def _load_ml_model():
    """Load Ridge model from disk. Returns (model, meta) or (None, None)."""
    try:
        import joblib, json
        if not _ML_MODEL.exists():
            return None, None
        model = joblib.load(_ML_MODEL)
        meta = json.loads(_ML_META.read_text()) if _ML_META.exists() else {}
        return model, meta
    except Exception as exc:
        print(f"[predict] Could not load ML model: {exc}", file=sys.stderr)
        return None, None


@app.get("/api/devices/{device_id}/predict")
def get_prediction(device_id: str) -> dict:
    """
    Run live Ridge-regression AQI prediction against the latest sensor reading.
    Falls back to CPCB formula if the model is not yet trained.
    """
    import numpy as np, pandas as pd

    supabase = get_supabase_client()

    # fetch latest sensor reading
    sensor_resp = (
        supabase.table("sensor_readings")
        .select("reading_id, pm25, co2, temperature, humidity, timestamp")
        .eq("device_id", device_id)
        .order("timestamp", desc=True)
        .limit(1)
        .execute()
    )
    sensor_row = maybe_single_row(sensor_resp.data or [])
    if not sensor_row:
        raise HTTPException(status_code=404, detail="No readings found for this device.")

    pm25        = sensor_row.get("pm25")
    co2         = sensor_row.get("co2")
    temperature = sensor_row.get("temperature")
    humidity    = sensor_row.get("humidity")
    timestamp   = sensor_row["timestamp"]

    raw_aqi   = pm25_to_aqi(pm25)
    raw_cat   = aqi_to_category(raw_aqi)

    model, meta = _load_ml_model()
    if model is not None:
        try:
            X = pd.DataFrame([{
                "pm25":        pm25,
                "co2":         co2,
                "temperature": temperature,
                "humidity":    humidity,
            }])
            ml_aqi = int(np.clip(round(float(model.predict(X)[0])), 0, 500))
            ml_cat = aqi_to_category(ml_aqi)
            return {
                "reading_id":          sensor_row.get("reading_id"),
                "timestamp":           timestamp,
                "raw_aqi":             raw_aqi,
                "raw_category":        raw_cat,
                "ml_aqi":              ml_aqi,
                "ml_category":         ml_cat,
                "final_aqi":           ml_aqi,
                "final_category":      ml_cat,
                "calibration_model":   meta.get("version", "ridge-v1"),
                "model_mae":           meta.get("mae"),
                "model_r2":            meta.get("r2"),
                "features_used":       {"pm25": pm25, "co2": co2, "temperature": temperature, "humidity": humidity},
                "ml_available":        True,
            }
        except Exception as exc:
            print(f"[predict] Inference error: {exc}", file=sys.stderr)

    # Fallback: CPCB formula
    return {
        "reading_id":        sensor_row.get("reading_id"),
        "timestamp":         timestamp,
        "raw_aqi":           raw_aqi,
        "raw_category":      raw_cat,
        "ml_aqi":            None,
        "ml_category":       None,
        "final_aqi":         raw_aqi,
        "final_category":    raw_cat,
        "calibration_model": "cpcb-formula",
        "model_mae":         None,
        "model_r2":          None,
        "features_used":     {"pm25": pm25, "co2": co2, "temperature": temperature, "humidity": humidity},
        "ml_available":      False,
    }
