/*
 * Migration: calibration columns, query indexes, RLS, and policies
 *
 * Section 1 — Adds nullable calibration metadata on aqi_results for ML/version tracking.
 * Section 2 — B-tree indexes for common dashboard/ingestion filters (device + time).
 * Section 3 — Enables row-level security on all five tables (no-op if already on).
 * Section 4 — Idempotent policies: anon SELECT everywhere; service_role INSERT/UPDATE
 *             for device data paths (ESP32 / backend using service key).
 */

-- =============================================================================
-- 1. New columns on aqi_results
-- =============================================================================

ALTER TABLE aqi_results
  ADD COLUMN IF NOT EXISTS calibrated_aqi INTEGER NULL;

ALTER TABLE aqi_results
  ADD COLUMN IF NOT EXISTS calibration_model_version VARCHAR(20) NULL;

-- =============================================================================
-- 2. Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_ts
  ON sensor_readings (device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_aqi_results_device_ts
  ON aqi_results (device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_aqi_results_reading
  ON aqi_results (reading_id);

CREATE INDEX IF NOT EXISTS idx_device_status_device_ts
  ON device_status_logs (device_id, last_seen DESC);

-- =============================================================================
-- 3. Row Level Security
-- =============================================================================

ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqi_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. Policies — public read (anon), service role writes
-- =============================================================================

DROP POLICY IF EXISTS "Public read locations" ON locations;
CREATE POLICY "Public read locations"
  ON locations
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Public read devices" ON devices;
CREATE POLICY "Public read devices"
  ON devices
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Public read sensor_readings" ON sensor_readings;
CREATE POLICY "Public read sensor_readings"
  ON sensor_readings
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Public read aqi_results" ON aqi_results;
CREATE POLICY "Public read aqi_results"
  ON aqi_results
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Public read device_status_logs" ON device_status_logs;
CREATE POLICY "Public read device_status_logs"
  ON device_status_logs
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Service insert sensor_readings" ON sensor_readings;
CREATE POLICY "Service insert sensor_readings"
  ON sensor_readings
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service insert aqi_results" ON aqi_results;
CREATE POLICY "Service insert aqi_results"
  ON aqi_results
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service insert device_status_logs" ON device_status_logs;
CREATE POLICY "Service insert device_status_logs"
  ON device_status_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service update devices" ON devices;
CREATE POLICY "Service update devices"
  ON devices
  FOR UPDATE
  TO service_role
  USING (true);
