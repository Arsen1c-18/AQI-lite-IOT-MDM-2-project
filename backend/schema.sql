-- Initial Database Schema for AQI Dashboard

-- 1. Create sensor_readings table
CREATE TABLE IF NOT EXISTS sensor_readings (
    reading_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    device_id UUID NOT NULL,
    pm25 DECIMAL(6,2),
    co2 DECIMAL(7,2),
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create aqi_results table
CREATE TABLE IF NOT EXISTS aqi_results (
    result_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reading_id UUID REFERENCES sensor_readings(reading_id),
    device_id UUID NOT NULL,
    calculated_aqi INTEGER,
    category VARCHAR(50),
    main_pollutant VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create devices table
CREATE TABLE IF NOT EXISTS devices (
    device_id UUID PRIMARY KEY,
    device_name VARCHAR(255),
    location_id UUID,
    is_active BOOLEAN DEFAULT true
);

-- 4. Create locations table
CREATE TABLE IF NOT EXISTS locations (
    location_id UUID PRIMARY KEY,
    location_name VARCHAR(255),
    location_type VARCHAR(100),
    address TEXT
);

-- 5. Create device_status_logs table
CREATE TABLE IF NOT EXISTS device_status_logs (
    log_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    device_id UUID REFERENCES devices(device_id),
    status VARCHAR(50),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Helper Function for Real-time Chart Data (Hourly Averages)
CREATE OR REPLACE FUNCTION get_hourly_averages(
    p_device_id UUID,
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    hour TIMESTAMP WITH TIME ZONE,
    avg_aqi INTEGER,
    avg_pm25 DECIMAL,
    avg_co2 DECIMAL,
    avg_temperature DECIMAL,
    avg_humidity DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE_TRUNC('hour', ar.timestamp) as hour,
        AVG(ar.calculated_aqi)::INTEGER as avg_aqi,
        AVG(sr.pm25)::DECIMAL(6,2) as avg_pm25,
        AVG(sr.co2)::DECIMAL(7,2) as avg_co2,
        AVG(sr.temperature)::DECIMAL(5,2) as avg_temperature,
        AVG(sr.humidity)::DECIMAL(5,2) as avg_humidity
    FROM aqi_results ar
    JOIN sensor_readings sr ON ar.reading_id = sr.reading_id
    WHERE ar.device_id = p_device_id
        AND ar.timestamp >= NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY DATE_TRUNC('hour', ar.timestamp)
    ORDER BY hour ASC;
END;
$$ LANGUAGE plpgsql;
