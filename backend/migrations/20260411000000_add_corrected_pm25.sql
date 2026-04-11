-- Migration: Add corrected_pm25 column to aqi_results
-- Required by the hybrid calibration pipeline (hybrid-v1).
-- The Edge Function now stores the physics-corrected PM2.5 value
-- alongside the raw reading for auditability.

ALTER TABLE public.aqi_results
  ADD COLUMN IF NOT EXISTS corrected_pm25 DECIMAL(6,2);

COMMENT ON COLUMN public.aqi_results.corrected_pm25 IS
  'PM2.5 after hybrid physics correction (humidity + temperature factors). '
  'Source: hybridCorrectPm25() in Edge Function calibrate-aqi. '
  'NULL for rows inserted before hybrid-v1 was deployed.';
