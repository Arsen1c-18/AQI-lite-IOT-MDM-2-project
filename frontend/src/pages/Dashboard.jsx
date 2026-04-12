import React, { useMemo } from 'react';
import Layout from '../components/Layout';
import AQIHero from '../components/AQIHero';
import SensorGrid from '../components/SensorGrid';
import HistoricalChart from '../components/HistoricalChart';
import DeviceStatus from '../components/DeviceStatus';
import Recommendations from '../components/Recommendations';
import { useAQIData } from '../hooks/useAQIData';
import { useRealtime } from '../hooks/useRealtime';
import { AlertTriangle, Wifi, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

function Dashboard() {
  const { latestData, historicalData, deviceInfo, mlPrediction, loading, error, refetch } = useAQIData();

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

  // Hard error (backend unreachable, bad config, etc.)
  if (error) {
    return (
      <Layout>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center h-[70vh] gap-6 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Connection Error</h2>
            <p className="text-text-secondary max-w-md">{error}</p>
          </div>
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-2xl font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-green-100"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </motion.div>
      </Layout>
    );
  }

  // No data yet — ESP32 not yet sending, but everything is configured correctly
  if (!latestData) {
    return (
      <Layout>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center h-[70vh] gap-6 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
            <Wifi className="w-10 h-10 text-accent animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Waiting for Sensor Data</h2>
            <p className="text-text-secondary max-w-md">
              Your device is configured and the backend is connected to Supabase.
              <br />
              Waiting for the first reading from your ESP32…
            </p>
          </div>
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-2xl font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-green-100"
          >
            <RefreshCw className="w-4 h-4" />
            Check Again
          </button>
        </motion.div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6 lg:gap-8 mb-8">

        {/* Top layer: Hero + Status/Recommendations side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">

          <div className="lg:col-span-3">
            <AQIHero
              aqi={latestData?.aqi}
              category={latestData?.category}
              prevAqi={prevAqi}
              mlPrediction={mlPrediction}
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
