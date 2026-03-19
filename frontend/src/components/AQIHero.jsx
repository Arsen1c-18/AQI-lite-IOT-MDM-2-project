import React from 'react';
import { getAqiInfo } from '../utils/constants';
import { motion } from 'framer-motion';

const AQIHero = ({ aqi, prevAqi }) => {
  const currentLevel = getAqiInfo(aqi) || { color: 'bg-gray-400', category: 'Unknown', textInfo: 'Loading...' };
  
  // Calculate trend
  const difference = prevAqi && aqi ? aqi - prevAqi : 0;
  const isImproving = difference <= 0;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`relative overflow-hidden rounded-3xl p-8 lg:p-12 text-white shadow-xl ${currentLevel.color.replace('bg-', 'bg-')}`}
    >
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
        <div>
          <h2 className="text-xl font-medium tracking-wide opacity-90 mb-1 uppercase text-white/80">Your Air Quality</h2>
          <div className="flex items-baseline justify-center md:justify-start gap-4">
            <motion.span 
              key={aqi}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-7xl md:text-9xl font-bold tracking-tighter"
            >
              {aqi !== null ? aqi : '--'}
            </motion.span>
            
            <div className="flex flex-col items-start">
              <span className="text-2xl font-semibold opacity-90 uppercase tracking-widest leading-none">
                {currentLevel.category}
              </span>
              
              {prevAqi && (
                <div className="flex items-center gap-1 mt-2 text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                  {isImproving ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span>Improving since last reading</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                      </svg>
                      <span>Worsening from {prevAqi}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="hidden md:block w-px h-24 bg-white/30" />
        
        <div className="max-w-xs p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
          <p className="font-medium text-lg leading-snug">
            {currentLevel.textInfo}
          </p>
          <div className="mt-4 opacity-75 text-sm">
            Based on current sensors in this room.
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AQIHero;
