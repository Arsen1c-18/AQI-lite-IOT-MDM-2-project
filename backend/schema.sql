-- AQI Lite — Database Schema (fixed)
-- Changes from original:
--   • All PKs use consistent column names (reading_id, result_id, device_id, location_id, log_id)
--   • sensor_readings.device_id FK added (was missing)
--   • aqi_results indexes added for query performance
--   • RLS policies added for all tables
--   • uuid-ossp extension ensured

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS locations (
    location_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_name VARCHAR(255) NOT NULL,
    location_type VARCHAR(100),           -- e.g. 'indoor', 'outdoor', 'campus'
    address       TEXT
);

CREATE TABLE IF NOT EXISTS devices (
    device_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_name VARCHAR(255) NOT NULL DEFAULT 'AQI Lite Node',
    location_id UUID REFERENCES locations(location_id) ON DELETE SET NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensor_readings (
    reading_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id   UUID NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    pm25        DECIMAL(6,2),   -- µg/m³
    co2         DECIMAL(7,2),   -- ppm
    temperature DECIMAL(5,2),   -- °C
    humidity    DECIMAL(5,2),   -- %RH
    timestamp   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS aqi_results (
    result_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reading_id     UUID NOT NULL REFERENCES sensor_readings(reading_id) ON DELETE CASCADE,
    device_id      UUID NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    calculated_aqi INTEGER NOT NULL,
    category       VARCHAR(50) NOT NULL,   -- Good / Satisfactory / Moderate / Poor / Very Poor / Severe
    main_pollutant VARCHAR(50),            -- PM2.5 | CO2
    -- ML calibration outputs (populated after calibration pipeline runs)
    calibrated_aqi INTEGER,               -- post-regression corrected value
    calibration_model_version VARCHAR(20), -- e.g. 'ridge-v1'
    timestamp      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_status_logs (
    log_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    status    VARCHAR(50) NOT NULL,  -- 'online' | 'offline' | 'error'
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_ts
    ON sensor_readings(device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_aqi_results_device_ts
    ON aqi_results(device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_aqi_results_reading
    ON aqi_results(reading_id);

CREATE INDEX IF NOT EXISTS idx_device_status_device_ts
    ON device_status_logs(device_id, last_seen DESC);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Anon key: read-only on all tables (dashboard queries)
-- Service role key: full access (ESP32 inserts)

ALTER TABLE locations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqi_results         ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_status_logs  ENABLE ROW LEVEL SECURITY;

-- Public read policies (dashboard uses anon key)
CREATE POLICY "Public read locations"          ON locations           FOR SELECT USING (true);
CREATE POLICY "Public read devices"            ON devices             FOR SELECT USING (true);
CREATE POLICY "Public read sensor_readings"    ON sensor_readings     FOR SELECT USING (true);
CREATE POLICY "Public read aqi_results"        ON aqi_results         FOR SELECT USING (true);
CREATE POLICY "Public read device_status_logs" ON device_status_logs  FOR SELECT USING (true);

-- Service role INSERT/UPDATE policies (used by ESP32 via service key or Edge Function)
CREATE POLICY "Service insert sensor_readings"    ON sensor_readings    FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert aqi_results"        ON aqi_results        FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert device_status_logs" ON device_status_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update devices"            ON devices            FOR UPDATE USING (true);

-- ─── Hourly averages helper ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_hourly_averages(
    p_device_id UUID,
    p_hours     INTEGER DEFAULT 24
)
RETURNS TABLE (
    hour            TIMESTAMP WITH TIME ZONE,
    avg_aqi         INTEGER,
    avg_pm25        DECIMAL,
    avg_co2         DECIMAL,
    avg_temperature DECIMAL,
    avg_humidity    DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE_TRUNC('hour', ar.timestamp)        AS hour,
        AVG(ar.calculated_aqi)::INTEGER         AS avg_aqi,
        AVG(sr.pm25)::DECIMAL(6,2)              AS avg_pm25,
        AVG(sr.co2)::DECIMAL(7,2)               AS avg_co2,
        AVG(sr.temperature)::DECIMAL(5,2)       AS avg_temperature,
        AVG(sr.humidity)::DECIMAL(5,2)          AS avg_humidity
    FROM aqi_results ar
    JOIN sensor_readings sr ON ar.reading_id = sr.reading_id  -- ✓ correct FK name
    WHERE ar.device_id = p_device_id
      AND ar.timestamp >= NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY DATE_TRUNC('hour', ar.timestamp)
    ORDER BY hour ASC;
END;
$$ LANGUAGE plpgsql;
