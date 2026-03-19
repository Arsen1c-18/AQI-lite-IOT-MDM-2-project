import React, { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import { useAQIData } from '../hooks/useAQIData';
import { motion } from 'framer-motion';
import { CalendarDays, TrendingDown, TrendingUp, Activity } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glassmorphism p-4 rounded-xl shadow-lg border border-green-100 text-sm">
        <p className="text-text-secondary font-medium mb-2">{label}</p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="capitalize text-text-secondary">{entry.name}:</span>
            <span className="font-mono font-semibold text-text-primary">{typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const StatCard = ({ label, value, unit, icon: Icon, trend, color }) => (
  <div className="glassmorphism rounded-2xl p-5 border border-white/40">
    <div className="flex justify-between items-start mb-3">
      <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">{label}</span>
      <Icon className={`w-4 h-4 ${color}`} />
    </div>
    <div className="text-3xl font-bold font-mono text-text-primary">{value ?? '--'}<span className="text-base text-text-secondary ml-1">{unit}</span></div>
    {trend !== undefined && (
      <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend <= 0 ? 'text-green-600' : 'text-red-500'}`}>
        {trend <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
        <span>{Math.abs(trend).toFixed(1)}% from yesterday</span>
      </div>
    )}
  </div>
);

const HistoryPage = () => {
  const { historicalData, latestData, loading } = useAQIData();
  const [activeMetric, setActiveMetric] = useState('all');

  const chartData = useMemo(() => {
    if (!historicalData) return [];
    return historicalData.map(item => ({
      time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      AQI: item.calculated_aqi,
      PM25: item.pm25 ? parseFloat(item.pm25.toFixed(1)) : null,
      CO2: item.co2 ? parseFloat(item.co2.toFixed(0)) : null,
    }));
  }, [historicalData]);

  const avgAQI = useMemo(() => {
    if (!historicalData.length) return null;
    return Math.round(historicalData.reduce((a, b) => a + (b.calculated_aqi || 0), 0) / historicalData.length);
  }, [historicalData]);

  const maxAQI = useMemo(() => historicalData.length ? Math.max(...historicalData.map(d => d.calculated_aqi || 0)) : null, [historicalData]);
  const minAQI = useMemo(() => historicalData.length ? Math.min(...historicalData.map(d => d.calculated_aqi || 0)) : null, [historicalData]);

  const metrics = [
    { key: 'all', label: 'All Metrics' },
    { key: 'AQI', label: 'AQI Only' },
    { key: 'PM25', label: 'PM2.5' },
    { key: 'CO2', label: 'CO₂' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-accent border-t-transparent animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 mb-12">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-accent text-sm font-bold uppercase tracking-wider mb-2">
              <CalendarDays className="w-4 h-4" /> Historical Data
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-text-primary">Last 24 Hours</h1>
            <p className="text-text-secondary mt-1">Trends in your air quality from the past day</p>
          </div>
          {/* Metric Toggles */}
          <div className="flex gap-2 flex-wrap">
            {metrics.map(m => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  activeMetric === m.key
                    ? 'bg-accent text-white border-accent shadow-md shadow-green-100'
                    : 'bg-white border-green-200 text-text-secondary hover:border-accent hover:text-accent'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Current AQI" value={latestData?.aqi} unit="" icon={Activity} color="text-accent" trend={-5.2} />
          <StatCard label="24h Average" value={avgAQI} unit="" icon={Activity} color="text-blue-500" />
          <StatCard label="24h Peak" value={maxAQI} unit="" icon={TrendingUp} color="text-red-500" />
          <StatCard label="24h Best" value={minAQI} unit="" icon={TrendingDown} color="text-green-600" />
        </div>

        {/* Main Chart */}
        <div className="glassmorphism rounded-3xl p-6 md:p-8 border border-green-100">
          <h2 className="text-xl font-semibold text-text-primary mb-6">AQI & PM2.5 Trend</h2>
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAQI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(22,163,74,0.08)" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#4b7a5e', fontSize: 11 }} minTickGap={30} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b7a5e', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '16px' }} />
                {(activeMetric === 'all' || activeMetric === 'AQI') && (
                  <Area type="monotone" dataKey="AQI" stroke="#16a34a" strokeWidth={2.5} fill="url(#gradAQI)" dot={false} activeDot={{ r: 4, fill: '#16a34a' }} animationDuration={1200} />
                )}
                {(activeMetric === 'all' || activeMetric === 'PM25') && (
                  <Area type="monotone" dataKey="PM25" stroke="#ef4444" strokeWidth={2} fill="url(#gradPM)" dot={false} activeDot={{ r: 4 }} animationDuration={1200} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CO2 Chart */}
        {(activeMetric === 'all' || activeMetric === 'CO2') && (
          <div className="glassmorphism rounded-3xl p-6 md:p-8 border border-green-100">
            <h2 className="text-xl font-semibold text-text-primary mb-6">CO₂ Concentration (ppm)</h2>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(22,163,74,0.08)" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#4b7a5e', fontSize: 11 }} minTickGap={30} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b7a5e', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="CO2" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} animationDuration={1200} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </motion.div>
    </Layout>
  );
};

export default HistoryPage;
