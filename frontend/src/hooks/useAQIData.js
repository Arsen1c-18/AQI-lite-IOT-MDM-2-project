import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { getDeviceId } from '../utils/deviceSettings';

// ─── Demo / fallback data ─────────────────────────────────────────────────────
const generateDemoHistory = () => {
  const rows = [];
  for (let i = 24; i >= 0; i--) {
    const d = new Date();
    d.setHours(d.getHours() - i);
    rows.push({
      timestamp:      d.toISOString(),
      final_aqi:      Math.floor(30 + Math.random() * 40),
      pm25:           parseFloat((10 + Math.random() * 15).toFixed(2)),
      co2:            parseFloat((400 + Math.random() * 60).toFixed(0)),
    });
  }
  return rows;
};

const DEMO_LATEST = {
  aqi:           42,
  category:      'Good',
  main_pollutant: 'PM2.5',
  pm25:          12.5,
  co2:           410,
  temperature:   22.4,
  humidity:      48,
  timestamp:     new Date().toISOString(),
};

const DEMO_DEVICE = {
  device_name: 'Demo Sensor (Offline)',
  last_seen:   new Date().toISOString(),
  status:      'offline',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useAQIData = () => {
  const [latestData,     setLatestData]     = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [deviceInfo,     setDeviceInfo]     = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [isDemo,         setIsDemo]         = useState(false);

  // ── Latest reading + device status ────────────────────────────────────────
  const fetchLatestData = useCallback(async () => {
    const DEVICE_ID = getDeviceId();

    if (!isSupabaseConfigured() || !DEVICE_ID || DEVICE_ID === 'your-device-uuid-here') {
      setLatestData(DEMO_LATEST);
      setDeviceInfo(DEMO_DEVICE);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    try {
      // 1. Latest AQI result — select result_id (PK), reading_id (FK), device_id
      //    FIX: was selecting 'id' which doesn't exist; schema uses 'result_id' and 'reading_id'
      const { data: aqiRow, error: aqiErr } = await supabase
        .from('aqi_results')
        .select('result_id, calculated_aqi, calibrated_aqi, category, main_pollutant, timestamp, reading_id, device_id')
        .eq('device_id', DEVICE_ID)          // ✓ device_id column exists
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (aqiErr) {
        if (aqiErr.code === 'PGRST116') throw new Error('No readings found yet for this device.');
        throw aqiErr;
      }

      // 2. Sensor reading via reading_id FK
      //    FIX: was querying .eq('id', ...) — schema PK is 'reading_id'
      let sensorRow = null;
      if (aqiRow?.reading_id) {
        const { data: sr, error: srErr } = await supabase
          .from('sensor_readings')
          .select('pm25, co2, temperature, humidity')
          .eq('reading_id', aqiRow.reading_id)   // ✓ reading_id is the PK
          .single();
        if (!srErr) sensorRow = sr;
      } else {
        // Fallback: latest reading for device
        const { data: sr } = await supabase
          .from('sensor_readings')
          .select('pm25, co2, temperature, humidity')
          .eq('device_id', DEVICE_ID)             // ✓ device_id column on sensor_readings
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();
        sensorRow = sr;
      }

      // 3. Device name
      //    FIX: was querying .eq('id', DEVICE_ID) — schema PK is 'device_id'
      const { data: deviceRow } = await supabase
        .from('devices')
        .select('device_name')
        .eq('device_id', DEVICE_ID)               // ✓ device_id is the PK
        .single();

      // 4. Latest status log
      const { data: statusRow } = await supabase
        .from('device_status_logs')
        .select('status, last_seen')
        .eq('device_id', DEVICE_ID)
        .order('last_seen', { ascending: false })
        .limit(1)
        .single();

      setLatestData({
        aqi:           aqiRow.calibrated_aqi ?? aqiRow.calculated_aqi,
        category:      aqiRow.category,
        main_pollutant: aqiRow.main_pollutant,
        pm25:          sensorRow?.pm25        ?? null,
        co2:           sensorRow?.co2         ?? null,
        temperature:   sensorRow?.temperature ?? null,
        humidity:      sensorRow?.humidity    ?? null,
        timestamp:     aqiRow.timestamp,
      });

      setDeviceInfo({
        device_name: deviceRow?.device_name || 'AQI Lite Node',
        last_seen:   statusRow?.last_seen   || aqiRow.timestamp,
        status:      statusRow?.status      || 'unknown',
      });

      setIsDemo(false);
      setError(null);
    } catch (err) {
      console.error('[useAQIData] fetchLatestData error:', err.message);
      setError(err.message);
      setLatestData(DEMO_LATEST);
      setDeviceInfo(DEMO_DEVICE);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Historical data (last 24 h) ────────────────────────────────────────────
  const fetchHistoricalData = useCallback(async () => {
    const DEVICE_ID = getDeviceId();

    if (!isSupabaseConfigured() || !DEVICE_ID || DEVICE_ID === 'your-device-uuid-here') {
      setHistoricalData(generateDemoHistory());
      return;
    }

    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error: err } = await supabase
        .from('aqi_results')
        .select('calculated_aqi, calibrated_aqi, timestamp, reading_id')  // ✓ reading_id not 'id'
        .eq('device_id', DEVICE_ID)
        .gte('timestamp', since)
        .order('timestamp', { ascending: true });

      if (err) throw err;

      if (!data || data.length === 0) {
        setHistoricalData(generateDemoHistory());
        return;
      }

      // Batch-fetch sensor data
      //   FIX: was querying .in('id', readingIds) — schema PK is 'reading_id'
      const readingIds = data.map(r => r.reading_id).filter(Boolean);
      let sensorMap = {};

      if (readingIds.length > 0) {
        const { data: sensors } = await supabase
          .from('sensor_readings')
          .select('reading_id, pm25, co2')          // ✓ select reading_id as the key
          .in('reading_id', readingIds);             // ✓ filter on reading_id

        if (sensors) {
          sensorMap = Object.fromEntries(sensors.map(s => [s.reading_id, s]));
        }
      }

      setHistoricalData(
        data.map(row => ({
          timestamp:      row.timestamp,
          final_aqi:      row.calibrated_aqi ?? row.calculated_aqi,
          pm25:           sensorMap[row.reading_id]?.pm25 ?? null,
          co2:            sensorMap[row.reading_id]?.co2  ?? null,
        }))
      );
    } catch (err) {
      console.error('[useAQIData] fetchHistoricalData error:', err.message);
      setHistoricalData(generateDemoHistory());
    }
  }, []);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchLatestData();
    fetchHistoricalData();

    const interval = setInterval(() => {
      fetchLatestData();
      fetchHistoricalData();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchLatestData, fetchHistoricalData]);

  const refetch = useCallback(() => {
    fetchLatestData();
    fetchHistoricalData();
  }, [fetchLatestData, fetchHistoricalData]);

  return { latestData, historicalData, deviceInfo, loading, error, isDemo, refetch };
};
