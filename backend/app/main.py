"""
AQI Lite — FastAPI Backend (v3.0.0)

Single-source-of-truth for AQI: the Supabase Edge Function
(calibrate-aqi/index.ts) runs on every sensor_readings INSERT,
applies physics correction, filters CO₂ spikes, computes CPCB dual-AQI,
and writes the result to aqi_results.

This backend NEVER computes AQI inline.  It only reads:
  - aqi_results   → pre-computed calibrated/raw AQI values
  - sensor_readings → raw sensor readings (pm25, co2, temp, humidity)

A LEFT JOIN query is used so that newly-inserted readings that have not
yet been processed by the Edge Function are returned with
  raw_aqi = None, final_aqi = None, category = "Pending"
instead of silently computing a wrong value.

Temperature & Humidity policy
──────────────────────────────
Both values are ALWAYS taken directly from sensor_readings (no ML, no AQI).
DHT11 sensors occasionally return physically impossible readings; when the
latest row is out of range, the backend scans the last 30 rows and returns
the most recently captured VALID value.
"""

import asyncio
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
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

# ─── Device offline watcher ───────────────────────────────────────────────────
# Tracks per-device online state in memory so we can detect true→false flips.
_device_was_online: dict[str, bool] = {}

# How long since last reading before device is considered offline (seconds)
OFFLINE_THRESHOLD_SEC = 30   # ← change to 900 (15 min) for production
WATCHER_INTERVAL_SEC  = 15   # how often the watcher polls


async def _device_offline_watcher() -> None:
    """Background task: checks device last_seen every WATCHER_INTERVAL_SEC seconds.
    Fires notify-off SMS when the device transitions online → offline."""
    device_id = settings.device_id
    if not device_id:
        print("[watcher] VITE_DEVICE_ID / DEVICE_ID not set — watcher disabled.", file=sys.stderr)
        return

    print(f"[watcher] Started. Monitoring device {device_id} (threshold={OFFLINE_THRESHOLD_SEC}s)", flush=True)

    while True:
        await asyncio.sleep(WATCHER_INTERVAL_SEC)
        try:
            supabase = get_supabase_client()
            resp = (
                supabase.table("sensor_readings")
                .select("timestamp")
                .eq("device_id", device_id)
                .order("timestamp", desc=True)
                .limit(1)
                .execute()
            )
            row = maybe_single_row(resp.data or [])
            last_seen_str = (row or {}).get("timestamp")

            if last_seen_str:
                last_seen = datetime.fromisoformat(last_seen_str.replace("Z", "+00:00"))
                diff_sec = abs((datetime.now(timezone.utc) - last_seen).total_seconds())
                is_online = diff_sec < OFFLINE_THRESHOLD_SEC
            else:
                is_online = False

            was_online = _device_was_online.get(device_id)  # None on first run
            _device_was_online[device_id] = is_online

            if was_online is True and not is_online:
                print(f"[watcher] Device {device_id} went OFFLINE → sending SMS", flush=True)
                notify_device_off(device_id)  # reuses device name lookup internally
            elif was_online is False and is_online:
                print(f"[watcher] Device {device_id} is back ONLINE", flush=True)

        except Exception as exc:
            print(f"[watcher] Error: {exc}", file=sys.stderr)


@asynccontextmanager
async def lifespan(app_instance):
    task = asyncio.create_task(_device_offline_watcher())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="AQI Lite Backend", version="3.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    most recently captured valid value — 100% from sensor_readings, no ML.
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


# ─── aqi_results join helper ──────────────────────────────────────────────────

def _fetch_aqi_result_for_reading(supabase, reading_id) -> dict | None:
    """
    Fetch the aqi_results row for a given reading_id.
    Returns None if the Edge Function has not yet processed this reading
    (race condition window — typically < 1 second).
    """
    if reading_id is None:
        return None
    try:
        resp = (
            supabase.table("aqi_results")
            .select(
                "calculated_aqi, calibrated_aqi, corrected_pm25, "
                "category, main_pollutant, calibration_model_version"
            )
            .eq("reading_id", reading_id)
            .limit(1)
            .execute()
        )
        return maybe_single_row(resp.data or [])
    except Exception as exc:
        print(f"[aqi_results] lookup failed for reading_id={reading_id}: {exc}", file=sys.stderr)
        return None


def _fetch_aqi_results_batch(supabase, reading_ids: list) -> dict:
    """
    Batch-fetch aqi_results rows for a list of reading_ids.
    Returns a dict keyed by reading_id.
    """
    if not reading_ids:
        return {}
    try:
        resp = (
            supabase.table("aqi_results")
            .select(
                "reading_id, calculated_aqi, calibrated_aqi, corrected_pm25, "
                "category, main_pollutant, calibration_model_version"
            )
            .in_("reading_id", reading_ids)
            .execute()
        )
        return {row["reading_id"]: row for row in (resp.data or []) if row.get("reading_id") is not None}
    except Exception as exc:
        print(f"[aqi_results] batch lookup failed: {exc}", file=sys.stderr)
        return {}


def _build_reading_payload(sensor_row: dict, aqi_row: dict | None) -> dict:
    """
    Merge a sensor_readings row with its aqi_results row.
    If aqi_row is None (Edge Function not yet processed), values are None
    and category is 'Pending' — AQI is never computed inline.
    """
    if aqi_row:
        return {
            "raw_aqi": aqi_row.get("calculated_aqi"),
            "final_aqi": aqi_row.get("calibrated_aqi"),
            "corrected_pm25": aqi_row.get("corrected_pm25"),
            "category": aqi_row.get("category", "Unknown"),
            "main_pollutant": aqi_row.get("main_pollutant"),
            "calibration_model_version": aqi_row.get("calibration_model_version"),
        }
    # Edge Function hasn't processed this reading yet
    return {
        "raw_aqi": None,
        "final_aqi": None,
        "corrected_pm25": None,
        "category": "Pending",
        "main_pollutant": None,
        "calibration_model_version": None,
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/devices/{device_id}/latest")
def get_latest(device_id: str) -> dict:
    supabase = get_supabase_client()

    # Fetch the absolute latest processed AQI reading
    aqi_resp = (
        supabase.table("aqi_results")
        .select("reading_id, device_id, calculated_aqi, calibrated_aqi, smoothed_aqi, corrected_pm25, category, main_pollutant, calibration_model_version, timestamp")
        .eq("device_id", device_id)
        .order("timestamp", desc=True)
        .limit(1)
        .execute()
    )
    aqi_row = maybe_single_row(aqi_resp.data or [])
    if not aqi_row:
        raise HTTPException(status_code=404, detail="No AQI readings found for this device.")

    # Fetch corresponding raw sensor reading for environment data
    sensor_resp = (
        supabase.table("sensor_readings")
        .select("pm25, co2, temperature, humidity")
        .eq("reading_id", aqi_row.get("reading_id"))
        .limit(1)
        .execute()
    )
    sensor_row = maybe_single_row(sensor_resp.data or []) or {}

    # Temperature & humidity: last VALID DB reading, zero ML involvement
    temp_val, hum_val = _get_valid_temp_hum(supabase, device_id, sensor_row)


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
    last_seen = (status_row or {}).get("last_seen") or aqi_row.get("timestamp")

    # LatestDataResponse mapping
    final_aqi = aqi_row.get("calibrated_aqi")
    raw_aqi   = aqi_row.get("calculated_aqi")
    smoothed_aqi = aqi_row.get("smoothed_aqi")

    # Use smoothed_aqi if it exists; otherwise fallback to the calibrated_aqi
    display_aqi = smoothed_aqi if smoothed_aqi is not None else final_aqi

    latest = LatestDataResponse(
        aqi=display_aqi,                            # smoothed AQI if available (PRIMARY display)
        raw_aqi=raw_aqi,                            # raw AQI (no correction)
        hybrid_aqi=final_aqi,                       # calibrated AQI (physics-corrected block)
        category=aqi_row.get("category", "Unknown"),
        main_pollutant=aqi_row.get("main_pollutant") or "PM2.5",
        calibration_model=aqi_row.get("calibration_model_version") or "pending",
        pm25=sensor_row.get("pm25"),
        corrected_pm25=aqi_row.get("corrected_pm25") or sensor_row.get("pm25"),
        co2=sensor_row.get("co2"),
        temperature=temp_val,   # last valid DB reading (>=18 °C), no ML
        humidity=hum_val,       # last valid DB reading (>=5 %),  no ML
        timestamp=aqi_row.get("timestamp"),
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
    now   = datetime.now(timezone.utc)
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

    # Batch-fetch all aqi_results for this window in a single query
    reading_ids = [r.get("reading_id") for r in rows if r.get("reading_id") is not None]
    aqi_map = _fetch_aqi_results_batch(supabase, reading_ids)

    points = []
    for row in rows:
        rid     = row.get("reading_id")
        aqi_row = aqi_map.get(rid)
        aqi_data = _build_reading_payload(row, aqi_row)

        points.append(
            HistoricalDataPoint(
                timestamp=row["timestamp"],
                final_aqi=aqi_data["final_aqi"],
                raw_aqi=aqi_data["raw_aqi"],
                corrected_pm25=aqi_data["corrected_pm25"],
                calibration_model=aqi_data["calibration_model_version"],
                pm25=row.get("pm25"),
                co2=row.get("co2"),
                temperature=row.get("temperature"),   # raw from DB
                humidity=row.get("humidity"),          # raw from DB
            )
        )

    return HistoricalDataResponse(data=points)


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

    success = notify_device_off(device_name)

    return {
        "status": "success" if success else "skipped",
        "message": "SMS sent" if success else "Twilio not configured",
        "device_name": device_name,
    }
