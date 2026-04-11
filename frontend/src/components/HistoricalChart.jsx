import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { motion } from 'framer-motion';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glassmorphism p-4 rounded-xl shadow-lg border border-white/20">
        <p className="text-text-secondary font-medium text-sm mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="font-medium text-text-primary capitalize">{entry.name}:</span>
            <span className="font-mono font-semibold">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const HistoricalChart = ({ data }) => {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map(item => ({
      time:    new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      AQI:     item.final_aqi,          // hybrid-corrected (recommended)
      RawAQI:  item.raw_aqi ?? null,     // unmodified baseline for comparison
      PM25:    item.pm25,
      CO2:     item.co2 ? Math.round(item.co2 / 10) : 0, // scaled for visual mapping
    }));
  }, [data]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center glassmorphism rounded-3xl mt-8">
        <p className="text-text-secondary">No historical data available</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glassmorphism rounded-3xl p-6 md:p-8 mt-8"
    >
      <div className="flex justify-between items-end mb-6">
        <div>
          <h3 className="text-xl font-semibold text-text-primary mb-1">Last 24 Hours</h3>
          <p className="text-sm text-text-secondary">Air quality trends over time</p>
        </div>
      </div>

      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorRawAqi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis 
              dataKey="time" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12 }}
              dy={10}
              minTickGap={30}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.5} label={{ position: 'insideTopLeft', value: 'Moderate Limit', fill: '#f59e0b', fontSize: 10 }} />
            <Area
              type="monotone"
              dataKey="AQI"
              name="Hybrid AQI"
              stroke="#3B82F6"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorAqi)"
              animationDuration={1500}
            />
            <Area
              type="monotone"
              dataKey="RawAQI"
              name="Raw AQI"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              fillOpacity={1}
              fill="url(#colorRawAqi)"
              animationDuration={1500}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="PM25"
              name="PM2.5"
              stroke="#ef4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPm)"
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-8 h-0.5 bg-blue-500 rounded" />
          Hybrid AQI (corrected)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-8 border-t-2 border-dashed border-amber-400" />
          Raw AQI (baseline)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-8 h-0.5 bg-red-400 rounded" />
          PM2.5 (µg/m³)
        </span>
      </div>
    </motion.div>
  );
};

export default HistoricalChart;
