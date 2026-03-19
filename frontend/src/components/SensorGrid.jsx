import React from 'react';
import { Thermometer, Droplet, Wind, ChevronsUp, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

// eslint-disable-next-line no-unused-vars
const SensorCard = ({ title, value, unit, icon: Icon, trend, colorClass, delay = 0, size = "normal" }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4 }}
      className={`glassmorphism rounded-3xl p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 ${size === "large" ? 'md:col-span-2' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-20`}>
            <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-').replace('-100', '-500')}`} />
          </div>
          <span className="text-text-secondary font-medium tracking-wide uppercase text-sm">
            {title}
          </span>
        </div>
        
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${trend > 0 ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-baseline gap-2">
        <span className="text-4xl font-bold tracking-tight text-text-primary font-mono">
          {value ?? '--'}
        </span>
        <span className="text-text-secondary font-medium uppercase tracking-wider text-sm">
          {unit}
        </span>
      </div>
      
      {/* Decorative mini sparkline placeholder */}
      <div className="absolute -bottom-4 -right-4 w-32 h-16 opacity-10 pointer-events-none transition-opacity duration-300 group-hover:opacity-20">
        <svg viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" className={colorClass.replace('bg-', 'text-')}>
          <path d="M0,40 Q20,30 40,35 T80,20 T100,25" />
        </svg>
      </div>
    </motion.div>
  );
};

const SensorGrid = ({ data }) => {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <SensorCard
        title="PM2.5"
        value={data.pm25?.toFixed(1)}
        unit="µg/m³"
        icon={Wind}
        colorClass="bg-red-500"
        trend={2.4}
        delay={0.1}
        size="large"
      />
      <SensorCard
        title="CO2"
        value={data.co2?.toFixed(0)}
        unit="ppm"
        icon={Activity}
        colorClass="bg-blue-500"
        trend={-1.2}
        delay={0.2}
      />
      <SensorCard
        title="Temp"
        value={data.temperature?.toFixed(1)}
        unit="°C"
        icon={Thermometer}
        colorClass="bg-orange-500"
        trend={0.5}
        delay={0.3}
      />
      <SensorCard
        title="Humidity"
        value={data.humidity?.toFixed(0)}
        unit="%"
        icon={Droplet}
        colorClass="bg-blue-400"
        trend={-3.0}
        delay={0.4}
      />
    </div>
  );
};

export default SensorGrid;
