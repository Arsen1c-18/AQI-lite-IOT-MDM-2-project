import React from 'react';
import { getAqiInfo } from '../utils/constants';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, Leaf } from 'lucide-react';

const AQIHero = ({ aqi, prevAqi }) => {
  const level = getAqiInfo(aqi) || {
    bgClass: 'bg-gradient-to-br from-slate-400 to-slate-600',
    textClass: 'text-white',
    category: 'No Data',
    textInfo: 'Waiting for sensor data...'
  };

  const difference = prevAqi && aqi ? aqi - prevAqi : null;
  const isImproving = difference !== null && difference <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`relative overflow-hidden rounded-3xl p-8 lg:p-12 ${level.bgClass} shadow-2xl`}
    >
      {/* Glassmorphism overlays */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
      <div className="absolute -top-28 -right-28 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-black/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-center gap-10 text-center lg:text-left">

        {/* AQI Number */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center lg:justify-start gap-2 mb-3">
            <Leaf className="w-5 h-5 text-white/70" />
            <span className="text-white/80 font-semibold tracking-widest uppercase text-sm">AQI Lite · Live Reading</span>
          </div>
          <motion.div
            key={aqi}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="text-[7rem] lg:text-[9rem] font-bold tracking-tighter text-white leading-none font-mono"
          >
            {aqi !== null && aqi !== undefined ? aqi : '--'}
          </motion.div>

          <div className="flex items-center gap-3 mt-2 justify-center lg:justify-start flex-wrap">
            <span className="text-white font-bold text-2xl">{level.category}</span>
            {difference !== null && (
              <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm text-white font-medium">
                {isImproving
                  ? <><TrendingDown className="w-4 h-4" /> Improving</>
                  : <><TrendingUp className="w-4 h-4" /> Worsening (+{difference})</>
                }
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px h-28 bg-white/25" />

        {/* Info Panel */}
        <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-6 max-w-xs text-left">
          <p className="text-white font-semibold text-lg leading-snug mb-2">{level.textInfo}</p>
          <p className="text-white/70 text-sm">{level.advice ?? ''}</p>
          <div className="mt-4 border-t border-white/20 pt-3 text-xs text-white/60">
            Updated live from your ESP32 sensor
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AQIHero;
