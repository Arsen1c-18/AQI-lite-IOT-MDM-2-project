import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { DEVICE_ID } from '../utils/constants';

// ─── Demo / fallback data ─────────────────────────────────────────────────────
const generateDemoHistory = () => {
  const rows = [];
  for (let i = 24; i >= 0; i--) {
    const d = new Date();
    d.setHours(d.getHours() - i);
    rows.push({
      timestamp: d.toISOString(),
      calculated_aqi: Math.floor(30 + Math.random() * 40),
      pm25: parseFloat((10 + Math.random() * 15).toFixed(2)),
      co2: parseFloat((400 + Math.random() * 60).toFixed(0)),
    });
  }
  return rows;
};

const DEMO_LATEST = {
  aqi: 42,
  category: 'Good',
  main_pollutant: 'PM2.5',
  pm25: 12.5,
  co2: 410,
  temperature: 22.4,
  humidity: 48,
  timestamp: new Date().toISOString(),
};

const DEMO_DEVICE = {
  device_name: 'Demo Sensor (Offline)',
  last_seen: new Date().toISOString(),
  status: 'offline',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useAQIData = () => {
  const [latestData, setLatestData] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDemo, setIsDemo] = useState(false);

  // ── Latest reading + device status ────────────────────────────────────────
  const fetchLatestData = useCallback(async () => {
    if (!isSupabaseConfigured() || !DEVICE_ID || DEVICE_ID === 'your-device-uuid-here') {
      setLatestData(DEMO_LATEST);
      setDeviceInfo(DEMO_DEVICE);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch the latest AQI result for this device
      const { data: aqiRow, error: aqiErr } = await supabase
        .from('aqi_results')
        .select('id, calculated_aqi, category, main_pollutant, timestamp, reading_id, device_id')
        .eq('device_id', DEVICE_ID)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (aqiErr) {
        if (aqiErr.code === 'PGRST116') throw new Error('No readings found yet for this device.');
        throw aqiErr;
      }

      // 2. Fetch sensor readings using the reading_id FK
      let sensorRow = null;
      if (aqiRow?.reading_id) {
        const { data: sr, error: srErr } = await supabase
          .from('sensor_readings')
          .select('pm25, co2, temperature, humidity')
          .eq('id', aqiRow.reading_id)
          .single();
        if (!srErr) sensorRow = sr;
      } else {
        // Fallback: fetch latest sensor_reading by device_id
        const { data: sr } = await supabase
          .from('sensor_readings')
          .select('pm25, co2, temperature, humidity')
          .eq('device_id', DEVICE_ID)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();
        sensorRow = sr;
      }

      // 3. Fetch device name + latest status log
      const { data: deviceRow } = await supabase
        .from('devices')
        .select('device_name')
        .eq('id', DEVICE_ID)
        .single();

      const { data: statusRow } = await supabase
        .from('device_status_logs')
        .select('status, last_seen')
        .eq('device_id', DEVICE_ID)
        .order('last_seen', { ascending: false })
        .limit(1)
        .single();

      setLatestData({
        aqi: aqiRow.calculated_aqi,
        category: aqiRow.category,
        main_pollutant: aqiRow.main_pollutant,
        pm25: sensorRow?.pm25 ?? null,
        co2: sensorRow?.co2 ?? null,
        temperature: sensorRow?.temperature ?? null,
        humidity: sensorRow?.humidity ?? null,
        timestamp: aqiRow.timestamp,
      });

      setDeviceInfo({
        device_name: deviceRow?.device_name || 'AQI Lite Node',
        last_seen: statusRow?.last_seen || aqiRow.timestamp,
        status: statusRow?.status || 'unknown',
      });

      setIsDemo(false);
      setError(null);
    } catch (err) {
      console.error('[useAQIData] fetchLatestData error:', err.message);
      setError(err.message);
      // Use demo data as fallback so the UI never breaks
      setLatestData(DEMO_LATEST);
      setDeviceInfo(DEMO_DEVICE);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Historical data (last 24 h) ────────────────────────────────────────────
  const fetchHistoricalData = useCallback(async () => {
    if (!isSupabaseConfigured() || !DEVICE_ID || DEVICE_ID === 'your-device-uuid-here') {
      setHistoricalData(generateDemoHistory());
      return;
    }

    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Join aqi_results with sensor_readings to get pm25 + co2 together
      const { data, error: err } = await supabase
        .from('aqi_results')
        .select(`
          calculated_aqi,
          timestamp,
          reading_id
        `)
        .eq('device_id', DEVICE_ID)
        .gte('timestamp', since)
        .order('timestamp', { ascending: true });

      if (err) throw err;

      if (!data || data.length === 0) {
        setHistoricalData(generateDemoHistory());
        return;
      }

      // Fetch sensor data for each reading_id in one batch query
      const readingIds = data.map(r => r.reading_id).filter(Boolean);
      let sensorMap = {};

      if (readingIds.length > 0) {
        const { data: sensors } = await supabase
          .from('sensor_readings')
          .select('id, pm25, co2')
          .in('id', readingIds);

        if (sensors) {
          sensorMap = Object.fromEntries(sensors.map(s => [s.id, s]));
        }
      }

      setHistoricalData(
        data.map(row => ({
          timestamp: row.timestamp,
          calculated_aqi: row.calculated_aqi,
          pm25: sensorMap[row.reading_id]?.pm25 ?? null,
          co2: sensorMap[row.reading_id]?.co2 ?? null,
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

    // Poll every 5 minutes as backup (realtime handles instant updates)
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
