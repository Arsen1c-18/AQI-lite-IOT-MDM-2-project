import React, { useMemo } from 'react';
import Layout from '../components/Layout';
import AQIHero from '../components/AQIHero';
import SensorGrid from '../components/SensorGrid';
import HistoricalChart from '../components/HistoricalChart';
import DeviceStatus from '../components/DeviceStatus';
import Recommendations from '../components/Recommendations';
import { useAQIData } from '../hooks/useAQIData';
import { useRealtime } from '../hooks/useRealtime';

function Dashboard() {
  const { latestData, historicalData, deviceInfo, loading, error, refetch } = useAQIData();

  useRealtime(refetch);

  const prevAqi = useMemo(() => {
    if (historicalData && historicalData.length >= 2) {
      return historicalData[historicalData.length - 2].calculated_aqi;
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
            <div className="w-12 h-12 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
            <p className="font-semibold text-text-secondary animate-pulse">Connecting to Aura sensors...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error && (!latestData || latestData.aqi === null)) {
    return (
      <Layout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="glassmorphism p-8 rounded-3xl text-center shadow-xl border border-red-200">
            <div className="text-error font-bold text-6xl mb-4">!</div>
            <h2 className="text-xl font-semibold mb-2">Error Connecting to Database</h2>
            <p className="text-text-secondary max-w-sm mb-6">{error}</p>
            <button 
              onClick={refetch}
              className="bg-accent hover:bg-white text-white hover:text-accent font-semibold px-6 py-2 rounded-xl transition-all border border-accent"
            >
              Retry Connection
            </button>
          </div>
        </div>
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

        {/* Middle Layer: Sensor Grid */}
        <div className="w-full">
           <SensorGrid data={latestData} />
        </div>

        {/* Bottom Layer: Chart */}
        <div className="w-full">
          <HistoricalChart data={historicalData} />
        </div>

      </div>
    </Layout>
  );
}

export default Dashboard;
