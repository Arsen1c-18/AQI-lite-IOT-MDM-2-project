"""
AQI Lite — FastAPI Backend
Queries sensor_readings directly since aqi_results is unused in the live DB.
AQI is computed here using CPCB PM2.5 linear-interpolation breakpoints.
ML predictions are pulled from ml_predictions table when available.
A /predict endpoint also supports live Ridge inference from the saved joblib model.

Temperature & Humidity policy
──────────────────────────────
Both values are ALWAYS taken directly from sensor_readings (no ML).
DHT11 sensors occasionally return physically impossible readings (e.g. 16 °C
in a warm room). When the latest reading is out of range, the backend scans
the last 30 rows and returns the most recently captured VALID value from the DB.
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
from .twilio_service import notify_device_on, notify_device_off

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


# ─── Sensor sanity helpers ────────────────────────────────────────────────────

def _valid_temp(t) -> bool:
    """Physically plausible indoor/outdoor temperature: 18–50 °C."""
    return t is not None and 18.0 <= float(t) <= 50.0


def _valid_hum(h) -> bool:
    """Physically plausible relative humidity: 5–98 %."""
    return h is not None and 5.0 <= float(h) <= 98.0


def _get_valid_temp_hum(supabase, device_id: str, latest_row: dict) -> tuple:
    """
    Return (temperature, humidity) guaranteed to be within sane ranges.
    Uses the latest row if valid; otherwise scans recent history for the
    most recently captured valid value — 100 % from sensor_readings, no ML.
    """
    temp_val = latest_row.get("temperature")
    hum_val  = latest_row.get("humidity")

    if _valid_temp(temp_val) and _valid_hum(hum_val):
        return temp_val, hum_val  # fast path — most rows are fine

    # Scan up to the last 30 readings for valid values
    try:
        scan_resp = (
            supabase.table("sensor_readings")
            .select("temperature, humidity")
            .eq("device_id", device_id)
            .order("timestamp", desc=True)
            .limit(30)
            .execute()
        )
        for row in (scan_resp.data or []):
            if not _valid_temp(temp_val) and _valid_temp(row.get("temperature")):
                temp_val = row["temperature"]
            if not _valid_hum(hum_val) and _valid_hum(row.get("humidity")):
                hum_val = row["humidity"]
            if _valid_temp(temp_val) and _valid_hum(hum_val):
                break  # both found — stop scanning
    except Exception as exc:
        print(f"[latest] temp/hum scan failed: {exc}", file=sys.stderr)

    return temp_val, hum_val


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _enrich_reading(row: dict, ml_map: dict | None = None) -> dict:
    """
    Compute AQI from PM2.5 for a sensor_readings row.
    Optionally overlay ml_predictions if available.
    Does NOT touch temperature or humidity — those come straight from the DB.
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

    # Fetch the absolute latest sensor reading
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

    # Temperature & humidity: last VALID DB reading, zero ML involvement
    temp_val, hum_val = _get_valid_temp_hum(supabase, device_id, sensor_row)

    # Try to get ML prediction for AQI only (table may not exist yet)
    ml_map: dict = {}
    rid = sensor_row.get("reading_id")
    if rid is not None:
        try:
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
        except Exception:
            pass  # ml_predictions table not yet created — skip silently

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
        corrected_pm25=sensor_row.get("pm25"),
        co2=sensor_row.get("co2"),
        temperature=temp_val,   # last valid DB reading (≥18 °C), no ML
        humidity=hum_val,       # last valid DB reading (≥5 %),  no ML
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
        # Fallback: return the last N rows regardless of timestamp
        sensor_resp2 = (
            supabase.table("sensor_readings")
            .select("reading_id, pm25, co2, temperature, humidity, timestamp")
            .eq("device_id", device_id)
            .order("timestamp", desc=True)
            .limit(hours)
            .execute()
        )
        rows = list(reversed(sensor_resp2.data or []))

    if not rows:
        return HistoricalDataResponse(data=[])

    # Batch-fetch ML predictions for AQI overlay (silently skip if table missing)
    reading_ids = [r.get("reading_id") for r in rows if r.get("reading_id") is not None]
    ml_map: dict = {}
    if reading_ids:
        try:
            ml_resp = (
                supabase.table("ml_predictions")
                .select("reading_id, predicted_aqi, predicted_category, pollution_source, confidence_score")
                .in_("reading_id", reading_ids)
                .execute()
            )
            for ml in (ml_resp.data or []):
                if ml.get("reading_id") is not None:
                    ml_map[ml["reading_id"]] = ml
        except Exception as ml_err:
            print(f"[history] ml_predictions lookup skipped: {ml_err}", file=sys.stderr)

    points = []
    for row in rows:
        enriched = _enrich_reading(row, ml_map)
        # For history, use the raw DB temp/humidity as-is (shows the full timeline).
        # Filtering bad readings would distort the historical graph.
        points.append(
            HistoricalDataPoint(
                timestamp=row["timestamp"],
                final_aqi=enriched["final_aqi"],
                raw_aqi=enriched["raw_aqi"],
                corrected_pm25=row.get("pm25"),
                calibration_model="ml-v1" if enriched["ml_aqi"] is not None else "cpcb-formula",
                pm25=row.get("pm25"),
                co2=row.get("co2"),
                temperature=row.get("temperature"),  # raw from DB
                humidity=row.get("humidity"),         # raw from DB
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


def _persist_ml_prediction(
    supabase,
    reading_id: Optional[str],
    predicted_aqi: Optional[int],
    predicted_category: Optional[str],
    model_version: Optional[str],
    raw_aqi: Optional[int],
) -> None:
    """Best-effort upsert for latest ML inference so history can reuse ML values."""
    if not reading_id or predicted_aqi is None:
        return

    payload = {
        "reading_id": reading_id,
        "predicted_aqi": int(predicted_aqi),
        "predicted_category": predicted_category,
        "pollution_source": "PM2.5",
        "confidence_score": None,
        "model_version": model_version,
        "raw_aqi": raw_aqi,
    }

    try:
        (
            supabase.table("ml_predictions")
            .upsert(payload, on_conflict="reading_id")
            .execute()
        )
    except Exception as exc:
        # Avoid breaking /predict if table/columns are not present yet.
        print(f"[predict] Could not persist ML prediction: {exc}", file=sys.stderr)


@app.get("/api/devices/{device_id}/predict")
def get_prediction(device_id: str) -> dict:
    """
    Run live Ridge-regression AQI prediction against the latest sensor reading.
    Falls back to CPCB formula if the model is not yet trained.
    Temperature & humidity in features_used come directly from the DB sensor reading.
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

    # Use validated temp/hum for ML features too (gives better predictions)
    temp_val, hum_val = _get_valid_temp_hum(supabase, device_id, sensor_row)

    pm25      = sensor_row.get("pm25")
    co2       = sensor_row.get("co2")
    timestamp = sensor_row["timestamp"]

    raw_aqi = pm25_to_aqi(pm25)
    raw_cat = aqi_to_category(raw_aqi)

    model, meta = _load_ml_model()
    if model is not None:
        try:
            X = pd.DataFrame([{
                "pm25":        pm25,
                "co2":         co2,
                "temperature": temp_val,
                "humidity":    hum_val,
            }])
            ml_aqi = int(np.clip(round(float(model.predict(X)[0])), 0, 500))
            ml_cat = aqi_to_category(ml_aqi)
            model_version = meta.get("version", "ridge-v1")

            _persist_ml_prediction(
                supabase=supabase,
                reading_id=sensor_row.get("reading_id"),
                predicted_aqi=ml_aqi,
                predicted_category=ml_cat,
                model_version=model_version,
                raw_aqi=raw_aqi,
            )

            return {
                "reading_id":          sensor_row.get("reading_id"),
                "timestamp":           timestamp,
                "raw_aqi":             raw_aqi,
                "raw_category":        raw_cat,
                "ml_aqi":              ml_aqi,
                "ml_category":         ml_cat,
                "final_aqi":           ml_aqi,
                "final_category":      ml_cat,
                "calibration_model":   model_version,
                "model_mae":           meta.get("mae"),
                "model_r2":            meta.get("r2"),
                "features_used":       {"pm25": pm25, "co2": co2, "temperature": temp_val, "humidity": hum_val},
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
        "features_used":     {"pm25": pm25, "co2": co2, "temperature": temp_val, "humidity": hum_val},
        "ml_available":      False,
    }


# ─── Twilio SMS helpers ───────────────────────────────────────────────────────

def _send_sms(body: str) -> bool:
    """
    Send an SMS via Twilio.
    Returns True on success, False if skipped (not configured) or on error.
    Silently no-ops if:
      - Twilio credentials are not set in .env
      - twilio Python package is not installed
    """
    cfg = get_settings()
    if not cfg.twilio_enabled:
        print("[twilio] credentials not set — SMS skipped", file=sys.stderr)
        return False

    try:
        from twilio.rest import Client  # type: ignore
        client = Client(cfg.twilio_account_sid, cfg.twilio_auth_token)
        client.messages.create(
            body=body,
            from_=cfg.twilio_phone_from,
            to=cfg.twilio_phone_to,
        )
        print(f"[twilio] SMS sent: {body[:60]}...", file=sys.stderr)
        return True
    except ImportError:
        print("[twilio] package not installed — run: pip install twilio", file=sys.stderr)
        return False
    except Exception as exc:
        print(f"[twilio] SMS send failed: {exc}", file=sys.stderr)
        return False


def notify_device_on(device_name: str) -> bool:
    """Fire SMS when ESP32 powers on / reconnects."""
    now = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")
    return _send_sms(
        f"✅ AQI Lite — {device_name} POWERED ON\n"
        f"Monitoring has started. Live data is being collected.\n"
        f"Time: {now}"
    )


def notify_device_off(device_name: str) -> bool:
    """Fire SMS when ESP32 goes offline."""
    now = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")
    return _send_sms(
        f"🔴 AQI Lite — {device_name} POWERED OFF\n"
        f"Device is offline. Monitoring has stopped.\n"
        f"Time: {now}"
    )


# ─── Device Notification Endpoints ───────────────────────────────────────────

@app.post("/api/devices/{device_id}/notify-on")
def notify_device_powered_on(device_id: str) -> dict[str, str]:
    """
    Called by firmware on boot to send SMS notification.
    Retrieves device name and triggers Twilio SMS.
    """
    supabase = get_supabase_client()

    # Fetch device name
    try:
        device_resp = (
            supabase.table("devices")
            .select("device_name")
            .eq("device_id", device_id)
            .limit(1)
            .execute()
        )
        device_row = maybe_single_row(device_resp.data or [])
        device_name = (device_row or {}).get("device_name") or "IoT Device"
    except Exception as exc:
        print(f"[notify-on] Failed to fetch device name: {exc}", file=sys.stderr)
        device_name = "IoT Device"

    # Send SMS
    success = notify_device_on(device_name)

    return {
        "status": "success" if success else "skipped",
        "message": "SMS sent" if success else "Twilio not configured",
        "device_name": device_name,
    }


@app.post("/api/devices/{device_id}/notify-off")
def notify_device_powered_off(device_id: str) -> dict[str, str]:
    """
    Called when device goes offline to send SMS notification.
    Can be triggered by frontend, backend scheduler, or firmware on shutdown.
    """
    supabase = get_supabase_client()

    # Fetch device name
    try:
        device_resp = (
            supabase.table("devices")
            .select("device_name")
            .eq("device_id", device_id)
            .limit(1)
            .execute()
        )
        device_row = maybe_single_row(device_resp.data or [])
        device_name = (device_row or {}).get("device_name") or "IoT Device"
    except Exception as exc:
        print(f"[notify-off] Failed to fetch device name: {exc}", file=sys.stderr)
        device_name = "IoT Device"

    # Send SMS
    success = notify_device_off(device_name)

    return {
        "status": "success" if success else "skipped",
        "message": "SMS sent" if success else "Twilio not configured",
        "device_name": device_name,
    }
