import React, { useMemo } from 'react';
import Layout from '../components/Layout';
import AQIHero from '../components/AQIHero';
import SensorGrid from '../components/SensorGrid';
import HistoricalChart from '../components/HistoricalChart';
import DeviceStatus from '../components/DeviceStatus';
import Recommendations from '../components/Recommendations';
import { useAQIData } from '../hooks/useAQIData';
import { useRealtime } from '../hooks/useRealtime';
import { AlertTriangle } from 'lucide-react';

function Dashboard() {
  const { latestData, historicalData, deviceInfo, loading, error, isDemo, refetch } = useAQIData();

  useRealtime(refetch);

  const prevAqi = useMemo(() => {
    if (historicalData && historicalData.length >= 2) {
      return historicalData[historicalData.length - 2].final_aqi;
    }
    return null;
  }, [historicalData]);

  const isOnline = useMemo(() => {
    if (!deviceInfo?.last_seen) return false;
    const diffMin = (new Date() - new Date(deviceInfo.last_seen)) / 1000 / 60;
    return diffMin < 10;
  }, [deviceInfo]);

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-accent border-t-transparent animate-spin" />
            <p className="font-semibold text-text-secondary animate-pulse">Connecting to AQI Lite sensors...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Demo mode banner */}
      {isDemo && (
        <div className="mb-6 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
          <span>
            <strong>Demo mode</strong> — Supabase is not connected yet. Add your keys to{' '}
            <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">frontend/.env</code> to see live data.
          </span>
        </div>
      )}

      {/* Error banner (when connected but a fetch failed) */}
      {error && !isDemo && (
        <div className="mb-6 flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={refetch}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6 lg:gap-8 mb-8">

        {/* Top layer: Hero + Status/Recommendations side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">

          <div className="lg:col-span-3">
            <AQIHero
              aqi={latestData?.aqi}
              category={latestData?.category}
              prevAqi={prevAqi}
            />
          </div>

          <div className="lg:col-span-1 flex flex-col gap-6 md:grid md:grid-cols-2 lg:flex lg:flex-col">
            <div className="flex-1">
              <DeviceStatus
                deviceName={deviceInfo?.device_name}
                lastSeen={deviceInfo?.last_seen}
                isOnline={isOnline}
              />
            </div>
            <div className="flex-1">
              <Recommendations aqi={latestData?.aqi} />
            </div>
          </div>
        </div>

        {/* Sensor Grid */}
        <div className="w-full">
          <SensorGrid data={latestData} />
        </div>

        {/* Historical Chart */}
        <div className="w-full">
          <HistoricalChart data={historicalData} />
        </div>

      </div>
    </Layout>
  );
}

export default Dashboard;
