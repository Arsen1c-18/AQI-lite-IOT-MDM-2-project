import { useState, useEffect, useCallback } from 'react';
import { getDeviceId, isValidDeviceId } from '../utils/deviceSettings';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useAQIData = () => {
  const [latestData,     setLatestData]     = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [deviceInfo,     setDeviceInfo]     = useState(null);
  const [mlPrediction,   setMlPrediction]   = useState(null);   // NEW: ML inference result
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  const fetchJson = useCallback(async (path) => {
    const res = await fetch(`${API_BASE_URL}${path}`);
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        detail = body?.detail || detail;
      } catch {
        // keep status text fallback
      }
      throw new Error(detail);
    }
    return res.json();
  }, []);

  // ── Latest reading + device status ────────────────────────────────────────
  const fetchLatestData = useCallback(async () => {
    const DEVICE_ID = getDeviceId();
    if (!isValidDeviceId(DEVICE_ID)) {
      setError('No device ID configured. Go to Settings and enter your device UUID.');
      setLoading(false);
      return;
    }

    try {
      const payload = await fetchJson(`/api/devices/${encodeURIComponent(DEVICE_ID)}/latest`);
      setLatestData(payload.latestData);
      setDeviceInfo(payload.deviceInfo);
      setError(null);
    } catch (err) {
      console.error('[useAQIData] fetchLatestData error:', err.message);
      // 404 means device exists but no readings yet — not a hard error
      if (err.message.includes('404') || err.message.toLowerCase().includes('no readings')) {
        setLatestData(null);
        setDeviceInfo(null);
        setError(null);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  // ── Historical data (last 24 h) ────────────────────────────────────────────
  const fetchHistoricalData = useCallback(async () => {
    const DEVICE_ID = getDeviceId();
    if (!isValidDeviceId(DEVICE_ID)) return;

    try {
      const payload = await fetchJson(`/api/devices/${encodeURIComponent(DEVICE_ID)}/history?hours=24`);
      setHistoricalData(payload?.data || []);
    } catch (err) {
      console.error('[useAQIData] fetchHistoricalData error:', err.message);
      setHistoricalData([]);
    }
  }, [fetchJson]);

  // ── ML Prediction (best available: Ridge model or CPCB fallback) ───────────
  const fetchMlPrediction = useCallback(async () => {
    const DEVICE_ID = getDeviceId();
    if (!isValidDeviceId(DEVICE_ID)) return;

    try {
      const payload = await fetchJson(`/api/devices/${encodeURIComponent(DEVICE_ID)}/predict`);
      setMlPrediction(payload);
    } catch (err) {
      // Predict endpoint failing is non-critical — silently ignore
      console.warn('[useAQIData] fetchMlPrediction error (non-fatal):', err.message);
      setMlPrediction(null);
    }
  }, [fetchJson]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchLatestData();
    fetchHistoricalData();
    fetchMlPrediction();

    // Poll every 20s for live updates
    const interval = setInterval(() => {
      fetchLatestData();
      fetchHistoricalData();
      fetchMlPrediction();
    }, 20 * 1000);

    return () => clearInterval(interval);
  }, [fetchLatestData, fetchHistoricalData, fetchMlPrediction]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchLatestData();
    fetchHistoricalData();
    fetchMlPrediction();
  }, [fetchLatestData, fetchHistoricalData, fetchMlPrediction]);

  return { latestData, historicalData, deviceInfo, mlPrediction, loading, error, refetch };
};
