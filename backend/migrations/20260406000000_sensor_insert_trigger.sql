-- Enable pg_net extension for HTTP requests if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Must be configured by the user with their anon key:
-- ALTER DATABASE postgres SET app.supabase_anon_key = '<anon_key>';

CREATE OR REPLACE FUNCTION public.compute_aqi_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_anon_key text;
  v_url text := 'https://sniaiplxtkbmdcfdnpmo.supabase.co/functions/v1/calibrate-aqi';
  v_payload jsonb;
BEGIN
  -- Retrieve the configured anon key
  v_anon_key := current_setting('app.supabase_anon_key', true);

  -- Build the exact payload expected by the Edge Function
  v_payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'sensor_readings',
    'schema', 'public',
    'record', row_to_json(NEW)
  );

  -- Perform the asynchronous HTTP POST request using pg_net
  PERFORM net.http_post(
    url := v_url,
    body := v_payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_anon_key, '')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make the trigger creation idempotent
DROP TRIGGER IF EXISTS sensor_readings_insert_webhook ON public.sensor_readings;

CREATE TRIGGER sensor_readings_insert_webhook
AFTER INSERT ON public.sensor_readings
FOR EACH ROW
EXECUTE FUNCTION public.compute_aqi_trigger_fn();
