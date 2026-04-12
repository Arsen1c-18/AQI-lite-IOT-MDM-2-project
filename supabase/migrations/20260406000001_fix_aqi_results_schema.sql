-- Fix for missing columns in aqi_results table
-- This migration ensures the schema matches what the frontend and ML pipeline expect.

DO $$ 
BEGIN
    -- 1. Ensure uuid-ossp extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- 2. Check and add result_id if missing (and make it PK)
    -- Note: If aqi_results already has a different PK, you may need to drop it first.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aqi_results' AND column_name='result_id') THEN
        ALTER TABLE aqi_results ADD COLUMN result_id UUID DEFAULT uuid_generate_v4();
        -- If no PK exists, set this as PK
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='aqi_results' AND constraint_type='PRIMARY KEY') THEN
            ALTER TABLE aqi_results ADD PRIMARY KEY (result_id);
        END IF;
    END IF;

    -- 3. Check and add calibrated_aqi if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aqi_results' AND column_name='calibrated_aqi') THEN
        ALTER TABLE aqi_results ADD COLUMN calibrated_aqi INTEGER;
    END IF;

    -- 4. Check and add calibration_model_version if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aqi_results' AND column_name='calibration_model_version') THEN
        ALTER TABLE aqi_results ADD COLUMN calibration_model_version VARCHAR(20);
    END IF;

END $$;
