-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ALTER DATABASE postgres SET app.supabase_anon_key = '<anon_key>';
CREATE OR REPLACE FUNCTION public.compute_aqi_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  webhook_payload JSONB;
  auth_header TEXT;
BEGIN
  -- Build the exact webhook payload shape the Edge Function expects
  webhook_payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'sensor_readings',
    'schema', 'public',
    'record', row_to_json(NEW)
  );

  -- Retrieve anon key and construct Authorization header
  auth_header := 'Bearer ' || current_setting('app.supabase_anon_key', true);

  -- Use pg_net.http_post to call the edge function
  PERFORM net.http_post(
    url := 'https://sniaiplxtkbmdcfdnpmo.supabase.co/functions/v1/calibrate-aqi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', auth_header
    ),
    body := webhook_payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Make the trigger idempotent
DROP TRIGGER IF EXISTS sensor_insert_trigger ON public.sensor_readings;

CREATE TRIGGER sensor_insert_trigger
AFTER INSERT ON public.sensor_readings
FOR EACH ROW
EXECUTE FUNCTION public.compute_aqi_trigger_fn();
