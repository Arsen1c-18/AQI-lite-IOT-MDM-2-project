-- Create ml_predictions table used by /api/devices/{device_id}/predict upsert flow.

CREATE TABLE IF NOT EXISTS ml_predictions (
    prediction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reading_id UUID NOT NULL REFERENCES sensor_readings(reading_id) ON DELETE CASCADE,
    predicted_aqi INTEGER NOT NULL,
    predicted_category VARCHAR(50),
    pollution_source VARCHAR(50),
    confidence_score NUMERIC(5,4),
    model_version VARCHAR(32),
    raw_aqi INTEGER,
    predicted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (reading_id)
);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_reading_id ON ml_predictions(reading_id);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_predicted_at ON ml_predictions(predicted_at DESC);

ALTER TABLE ml_predictions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'ml_predictions'
          AND policyname = 'Public read ml_predictions'
    ) THEN
        CREATE POLICY "Public read ml_predictions"
            ON ml_predictions
            FOR SELECT
            USING (true);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'ml_predictions'
          AND policyname = 'Service write ml_predictions'
    ) THEN
        CREATE POLICY "Service write ml_predictions"
            ON ml_predictions
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;
