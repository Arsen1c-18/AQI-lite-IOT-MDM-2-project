/**
 * AQI Lite — Database Webhook handler
 * Trigger: INSERT on public.sensor_readings
 *
 * Dual-AQI calibration pipeline:
 *   Step 1 — Hybrid physics correction:
 *     correctedPm25 = hybridCorrectPm25(rawPm25, humidity, temperature)
 *
 *   Step 2 — Compute BOTH AQI values independently:
 *     rawAqiData    = computeCpcbSide(rawPm25, co2)     → baseline, no correction
 *     hybridAqiData = computeCpcbSide(correctedPm25, co2) → physics-corrected
 *
 *   Step 3 — DB columns written:
 *     calculated_aqi         → raw AQI (from raw PM2.5, unmodified baseline)
 *     calibrated_aqi         → hybrid AQI (physics-corrected, always populated)
 *     corrected_pm25         → physics-corrected PM2.5 value
 *     category               → from hybridAqiData (corrected is more accurate)
 *     main_pollutant         → from hybridAqiData
 *     calibration_model_version → 'hybrid-v1' always; 'ridge-v1' if ML active
 *
 *   Step 4 — ML Ridge (optional, CALIBRATION_MODEL_JSON secret):
 *     If model present: overrides calibrated_aqi only. calculated_aqi stays raw.
 *
 * Frontend usage:
 *   final_aqi = calibrated_aqi ?? calculated_aqi
 *   raw_aqi   = calculated_aqi   (for comparison/debugging)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CPCB PM2.5 breakpoints [C_lo, C_hi, I_lo, I_hi] ─────────────────────────
const PM25_BREAKPOINTS: [number, number, number, number][] = [
  [0, 30, 0, 50],
  [30, 60, 51, 100],
  [60, 90, 101, 200],
  [90, 120, 201, 300],
  [120, 250, 301, 400],
  [250, 500, 401, 500],
];

// CO₂ sub-index (ppm) — same practical scale as frontend computeAQI.js
const CO2_BREAKPOINTS: [number, number, number, number][] = [
  [0, 400, 0, 50],
  [400, 600, 51, 100],
  [600, 1000, 101, 200],
  [1000, 1500, 201, 300],
  [1500, 2500, 301, 400],
  [2500, 5000, 401, 500],
];

const AQI_CATEGORY_ORDER: { max: number; label: string }[] = [
  { max: 50, label: "Good" },
  { max: 100, label: "Satisfactory" },
  { max: 200, label: "Moderate" },
  { max: 300, label: "Poor" },
  { max: 400, label: "Very Poor" },
  { max: 500, label: "Severe" },
];

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: SensorRecord;
  schema?: string;
};

type SensorRecord = {
  reading_id?: string | number;  // FIX: accept both string and number (live DB uses bigint)
  device_id?: string;
  pm25?: number | string | null;
  co2?: number | string | null;
  temperature?: number | string | null;
  humidity?: number | string | null;
  timestamp?: string | null;
};

type CalibrationModelJson = {
  version?: string;
  features?: string[];
  coefficients?: Record<string, number>;
  intercept?: number;
  scaler?: {
    mean?: Record<string, number>;
    scale?: Record<string, number>;
  };
};

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

// FIX: Convert reading_id to the correct type for the live DB schema.
// The live sensor_readings table uses bigint (auto-increment) not UUID.
// pg_net sends the row as JSON where bigint comes through as a number.
// This function normalises it to a number so the FK insert matches.
function normaliseReadingId(id: string | number | undefined): number | null {
  if (id === undefined || id === null) return null;
  const n = typeof id === "number" ? id : parseInt(String(id), 10);
  return Number.isFinite(n) ? n : null;
}

function linearSubIndex(
  concentration: number,
  breakpoints: [number, number, number, number][],
): number {
  const c = Math.max(0, concentration);
  for (const [cLo, cHi, iLo, iHi] of breakpoints) {
    if (c >= cLo && c <= cHi) {
      const aqi = ((iHi - iLo) / (cHi - cLo)) * (c - cLo) + iLo;
      return Math.round(aqi);
    }
  }
  return 500;
}

function subIndexPm25(ugm3: number | null): number | null {
  if (ugm3 === null) return null;
  return linearSubIndex(ugm3, PM25_BREAKPOINTS);
}

function subIndexCo2(ppm: number | null): number | null {
  if (ppm === null) return null;
  return linearSubIndex(ppm, CO2_BREAKPOINTS);
}

function categoryFromAqi(aqi: number): string {
  for (const row of AQI_CATEGORY_ORDER) {
    if (aqi <= row.max) return row.label;
  }
  return "Severe";
}

// ─── Hybrid PM2.5 Physics Correction ─────────────────────────────────────────
function hybridCorrectPm25(
  pm25: number | null,
  humidity: number | null,
  temperature: number | null,
): number | null {
  if (pm25 === null) return null;

  let corrected = pm25;

  if (humidity !== null) {
    const humidityFactor = 1 - 0.02 * (humidity - 50) / 50;
    corrected *= humidityFactor;
  }

  if (temperature !== null) {
    const tempFactor = 1 + 0.01 * (temperature - 25) / 25;
    corrected *= tempFactor;
  }

  return Math.max(0, Math.round(corrected * 100) / 100);
}

// ─── CPCB AQI from two pollutants ────────────────────────────────────────────
function computeCpcbSide(
  pm25: number | null,
  co2: number | null,
): {
  calculated_aqi: number | null;
  category: string;
  main_pollutant: string | null;
} {
  const pmIdx = subIndexPm25(pm25);
  const coIdx = subIndexCo2(co2);
  const parts: { name: string; idx: number }[] = [];
  if (pmIdx !== null) parts.push({ name: "PM2.5", idx: pmIdx });
  if (coIdx !== null) parts.push({ name: "CO2", idx: coIdx });

  if (parts.length === 0) {
    return { calculated_aqi: null, category: "Unknown", main_pollutant: null };
  }

  const calculated_aqi = Math.max(...parts.map((p) => p.idx));
  const atMax = parts.filter((p) => p.idx === calculated_aqi);
  const main_pollutant = atMax.some((p) => p.name === "PM2.5")
    ? "PM2.5"
    : atMax[0].name;

  return {
    calculated_aqi,
    category: categoryFromAqi(calculated_aqi),
    main_pollutant,
  };
}

// ─── Optional ML Ridge model ──────────────────────────────────────────────────
function loadCalibrationModel(): CalibrationModelJson | null {
  const raw = Deno.env.get("CALIBRATION_MODEL_JSON");
  if (!raw || !raw.trim()) {
    console.log("[calibrate-aqi] CALIBRATION_MODEL_JSON not set — skipping Ridge inference");
    return null;
  }
  try {
    const m = JSON.parse(raw) as CalibrationModelJson;
    if (!m.coefficients || !m.scaler?.mean || !m.scaler?.scale || m.intercept === undefined) {
      console.warn("[calibrate-aqi] CALIBRATION_MODEL_JSON missing required fields");
      return null;
    }
    console.log("[calibrate-aqi] Loaded calibration model version:", m.version ?? "(none)");
    return m;
  } catch (e) {
    console.warn("[calibrate-aqi] Invalid CALIBRATION_MODEL_JSON:", e);
    return null;
  }
}

function predictMlAqi(
  record: SensorRecord,
  model: CalibrationModelJson,
): { value: number; version: string } | null {
  const features = model.features ?? ["pm25", "co2", "temperature", "humidity"];
  const coef = model.coefficients!;
  const mean = model.scaler!.mean!;
  const scale = model.scaler!.scale!;
  let sum = typeof model.intercept === "number" ? model.intercept : 0;

  for (const name of features) {
    let raw = num(record[name as keyof SensorRecord] as number | string | null);
    if (raw === null) {
      raw = mean[name] ?? 0;
      console.log(`[calibrate-aqi] ML: imputed ${name} with mean ${raw}`);
    }
    const s = scale[name];
    const denom = s !== undefined && s !== 0 ? s : 1e-9;
    const scaled = (raw - (mean[name] ?? 0)) / denom;
    sum += scaled * (coef[name] ?? 0);
  }

  const clamped = Math.max(0, Math.min(500, Math.round(sum)));
  const version = typeof model.version === "string" ? model.version : "ridge-v1";
  return { value: clamped, version };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    console.error("[calibrate-aqi] Invalid JSON body");
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  console.log("[calibrate-aqi] Webhook type:", payload.type, "table:", payload.table);

  if (payload.type !== "INSERT" || !payload.record) {
    console.warn("[calibrate-aqi] Rejecting: expected INSERT with record");
    return jsonResponse(400, { error: "Expected type INSERT and a record object" });
  }

  const rec = payload.record as SensorRecord;

  // FIX: normalise reading_id from bigint (live DB) — was causing 500 on insert
  // Live sensor_readings.reading_id is bigint auto-increment, not UUID.
  // JSON serialises bigint as a number; cast it explicitly to avoid type mismatch.
  const readingId = normaliseReadingId(rec.reading_id);
  const deviceId = rec.device_id;

  if (!readingId || !deviceId) {
    console.warn("[calibrate-aqi] Missing reading_id or device_id", { readingId, deviceId });
    return jsonResponse(400, { error: "record.reading_id and record.device_id are required" });
  }

  // ── 1. Extract raw sensor values ───────────────────────────────────────────
  const rawPm25 = num(rec.pm25);
  let co2 = num(rec.co2);
  const humidity = num(rec.humidity);
  const temperature = num(rec.temperature);

  // Filter unrealistic CO₂ values (sensor warm-up bug)
  if (co2 !== null && co2 > 2000) {
    console.warn("[calibrate-aqi] Ignoring unrealistic CO₂ value:", co2);
    co2 = null;
  }

  // ── 2. Hybrid physics correction on PM2.5 ─────────────────────────────────
  const correctedPm25 = hybridCorrectPm25(rawPm25, humidity, temperature);
  console.log(
    "[calibrate-aqi] PM2.5 raw:", rawPm25,
    "-> corrected:", correctedPm25,
    "| humidity:", humidity, "temp:", temperature,
  );

  // ── 3. Dual AQI computation ───────────────────────────────────────────────
  const rawAqiData = computeCpcbSide(rawPm25, co2);
  const hybridAqiData = computeCpcbSide(correctedPm25, co2);

  console.log(
    "[calibrate-aqi] Raw AQI:", rawAqiData.calculated_aqi,
    "| Hybrid AQI:", hybridAqiData.calculated_aqi,
    "| category:", hybridAqiData.category,
  );

  const calculated_aqi = rawAqiData.calculated_aqi;
  let calibrated_aqi: number | null = hybridAqiData.calculated_aqi;
  let calibration_model_version: string | null = "hybrid-v1";
  const { category, main_pollutant } = hybridAqiData;

  // ── 4. Optional ML Ridge inference ────────────────────────────────────────
  const mlModel = loadCalibrationModel();
  if (mlModel) {
    try {
      const pred = predictMlAqi(rec, mlModel);
      if (pred) {
        calibrated_aqi = pred.value;
        calibration_model_version = pred.version;
        console.log("[calibrate-aqi] ML override calibrated_aqi:", calibrated_aqi);
      }
    } catch (e) {
      console.warn("[calibrate-aqi] ML inference failed — retaining hybrid_aqi:", e);
    }
  }

  // ── 5. Supabase client ────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("[calibrate-aqi] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return jsonResponse(500, { error: "Server misconfiguration" });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── 6. Idempotency check ──────────────────────────────────────────────────
  // FIX: use normalised number readingId not raw string
  console.log("[calibrate-aqi] Idempotency check for reading_id:", readingId);
  const { data: existing, error: exErr } = await supabase
    .from("aqi_results")
    .select("result_id")
    .eq("reading_id", readingId)   // FIX: readingId is now a number matching bigint
    .maybeSingle();

  if (exErr) {
    console.error("[calibrate-aqi] Idempotency check error:", exErr.message);
    return jsonResponse(500, { error: exErr.message });
  }
  if (existing) {
    console.log("[calibrate-aqi] Row already exists — idempotent skip");
    return jsonResponse(200, { success: true, idempotent: true });
  }

  const ts = rec.timestamp && String(rec.timestamp).length > 0
    ? rec.timestamp
    : new Date().toISOString();

  // ── 7. Compute SMOOTHED AQI (NEW) ─────────────────────────────────────────

  // Fetch last 5 AQI readings
  const { data: prevRows } = await supabase
    .from("aqi_results")
    .select("calibrated_aqi")
    .eq("device_id", deviceId)
    .order("timestamp", { ascending: false })
    .limit(5);

  let smoothed_aqi = calibrated_aqi;

  if (prevRows && prevRows.length > 0 && calibrated_aqi !== null) {
    const values = prevRows
      .map((r) => r.calibrated_aqi)
      .filter((v) => v !== null);

    if (values.length > 0) {
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

      // Weighted smoothing (better than simple average)
      smoothed_aqi = Math.round(0.6 * calibrated_aqi + 0.4 * avg);
    }
  }

  console.log(
    "[calibrate-aqi] Smoothed AQI:",
    smoothed_aqi,
    "| Raw:", calibrated_aqi
  );

  // ── 8. Insert result row ──────────────────────────────────────────────────
  const insertRow = {
    reading_id: readingId,
    device_id: deviceId,
    calculated_aqi,
    calibrated_aqi,
    smoothed_aqi,
    corrected_pm25: correctedPm25,
    category,
    main_pollutant,
    calibration_model_version,
    timestamp: ts,
  };

  console.log("[calibrate-aqi] Inserting aqi_results:", JSON.stringify(insertRow));
  const { error: insErr } = await supabase.from("aqi_results").insert(insertRow);

  if (insErr) {
    if (insErr.code === "23505" || insErr.message?.includes("duplicate")) {
      console.log("[calibrate-aqi] Duplicate key — idempotent success");
      return jsonResponse(200, { success: true, idempotent: true });
    }
    console.error("[calibrate-aqi] Insert error:", insErr);
    return jsonResponse(500, { error: insErr.message });
  }

  console.log("[calibrate-aqi] Success");
  return jsonResponse(200, {
    success: true,
    raw_pm25: rawPm25,
    corrected_pm25: correctedPm25,
    calculated_aqi,
    calibrated_aqi,
    calibration_model_version,
  });
});

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}