/**
 * AQI Lite — Database Webhook handler
 * Trigger: INSERT on public.sensor_readings
 * Inserts one row into public.aqi_results with CPCB calculated AQI + optional Ridge calibration.
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
  reading_id?: string;
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
    return {
      calculated_aqi: null,
      category: "Unknown",
      main_pollutant: null,
    };
  }

  const calculated_aqi = Math.max(...parts.map((p) => p.idx));
  const atMax = parts.filter((p) => p.idx === calculated_aqi);
  // Tie-break: PM2.5 is primary when sub-indices are equal
  const main_pollutant = atMax.some((p) => p.name === "PM2.5") ? "PM2.5" : atMax[0].name;

  return {
    calculated_aqi,
    category: calculated_aqi !== null ? categoryFromAqi(calculated_aqi) : "Unknown",
    main_pollutant,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE AFTER RETRAINING — paste new JSON into secret CALIBRATION_MODEL_JSON
// (coefficients + scaler.mean/scale + intercept + version from training export)
// ═══════════════════════════════════════════════════════════════════════════
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

function predictCalibratedAqi(
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
      console.log(`[calibrate-aqi] Imputed ${name} with mean ${raw}`);
    }
    const s = scale[name];
    const denom = s !== undefined && s !== 0 ? s : 1e-9;
    const scaled = (raw - (mean[name] ?? 0)) / denom;
    const c = coef[name] ?? 0;
    sum += scaled * c;
  }

  const rounded = Math.round(sum);
  const clamped = Math.max(0, Math.min(500, rounded));
  const version = typeof model.version === "string" ? model.version : "ridge-v1";
  return { value: clamped, version };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

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
  const readingId = rec.reading_id;
  const deviceId = rec.device_id;

  if (!readingId || !deviceId) {
    console.warn("[calibrate-aqi] Missing reading_id or device_id");
    return jsonResponse(400, { error: "record.reading_id and record.device_id are required" });
  }

  const pm25 = num(rec.pm25);
  const co2 = num(rec.co2);

  const { calculated_aqi, category, main_pollutant } = computeCpcbSide(pm25, co2);
  console.log(
    "[calibrate-aqi] CPCB side — aqi:",
    calculated_aqi,
    "category:",
    category,
    "main:",
    main_pollutant,
  );

  let calibrated_aqi: number | null = null;
  let calibration_model_version: string | null = null;

  const model = loadCalibrationModel();
  if (model) {
    try {
      const pred = predictCalibratedAqi(rec, model);
      if (pred) {
        calibrated_aqi = pred.value;
        calibration_model_version = pred.version;
        console.log("[calibrate-aqi] Ridge calibrated_aqi:", calibrated_aqi, "version:", calibration_model_version);
      }
    } catch (e) {
      console.warn("[calibrate-aqi] Ridge inference failed (leaving calibrated null):", e);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("[calibrate-aqi] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return jsonResponse(500, { error: "Server misconfiguration" });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log("[calibrate-aqi] Idempotency check for reading_id:", readingId);
  const { data: existing, error: exErr } = await supabase
    .from("aqi_results")
    .select("result_id")
    .eq("reading_id", readingId)
    .maybeSingle();

  if (exErr) {
    console.error("[calibrate-aqi] Idempotency select error:", exErr.message);
    return jsonResponse(500, { error: exErr.message });
  }

  if (existing) {
    console.log("[calibrate-aqi] Row already exists for reading_id — skipping insert (idempotent)");
    return jsonResponse(200, { success: true, idempotent: true });
  }

  const ts = rec.timestamp && String(rec.timestamp).length > 0
    ? rec.timestamp
    : new Date().toISOString();

  const insertRow = {
    reading_id,
    device_id: deviceId,
    calculated_aqi,
    category,
    main_pollutant,
    calibrated_aqi,
    calibration_model_version,
    timestamp: ts,
  };

  console.log("[calibrate-aqi] Inserting aqi_results:", JSON.stringify(insertRow));

  const { error: insErr } = await supabase.from("aqi_results").insert(insertRow);

  if (insErr) {
    if (insErr.code === "23505" || insErr.message?.includes("duplicate")) {
      console.log("[calibrate-aqi] Duplicate key — treating as idempotent success");
      return jsonResponse(200, { success: true, idempotent: true });
    }
    console.error("[calibrate-aqi] Insert error:", insErr);
    return jsonResponse(500, { error: insErr.message });
  }

  console.log("[calibrate-aqi] Success");
  return jsonResponse(200, { success: true });
});

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
