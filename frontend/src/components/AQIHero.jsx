import React from 'react';
import { getAqiInfo } from '../utils/constants';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, Leaf, BrainCircuit, FlaskConical } from 'lucide-react';

/**
 * AQIHero
 * Props:
 *   aqi           – final AQI to display (raw or ML-corrected, whichever latest returns)
 *   prevAqi       – previous AQI for trend badge
 *   mlPrediction  – object from /api/devices/:id/predict
 *                   { ml_aqi, raw_aqi, final_aqi, calibration_model, ml_available,
 *                     model_mae, model_r2, final_category }
 */
const AQIHero = ({ aqi, prevAqi, mlPrediction }) => {
  // If ML prediction is available, prefer its final_aqi for display
  const displayAqi  = mlPrediction?.final_aqi  ?? aqi;
  const level = getAqiInfo(displayAqi) || {
    bgClass: 'bg-gradient-to-br from-slate-400 to-slate-600',
    textClass: 'text-white',
    category: 'No Data',
    textInfo: 'Waiting for sensor data...',
    advice: '',
  };

  const displayCategory = mlPrediction?.final_category ?? level.category;

  const difference = prevAqi && displayAqi ? displayAqi - prevAqi : null;
  const isImproving = difference !== null && difference <= 0;

  const mlAvailable  = mlPrediction?.ml_available === true;
  const rawAqi       = mlPrediction?.raw_aqi ?? aqi;
  const mlAqi        = mlPrediction?.ml_aqi;
  const modelName    = mlPrediction?.calibration_model ?? 'cpcb-formula';
  const modelMae     = mlPrediction?.model_mae;
  const modelR2      = mlPrediction?.model_r2;

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
            key={displayAqi}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="text-[7rem] lg:text-[9rem] font-bold tracking-tighter text-white leading-none font-mono"
          >
            {displayAqi !== null && displayAqi !== undefined ? displayAqi : '--'}
          </motion.div>

          <div className="flex items-center gap-3 mt-2 justify-center lg:justify-start flex-wrap">
            <span className="text-white font-bold text-2xl">{displayCategory}</span>

            {difference !== null && (
              <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm text-white font-medium">
                {isImproving
                  ? <><TrendingDown className="w-4 h-4" /> Improving</>
                  : <><TrendingUp className="w-4 h-4" /> Worsening (+{difference})</>
                }
              </div>
            )}

            {/* Model badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
              mlAvailable ? 'bg-blue-500/30 text-white' : 'bg-white/15 text-white/80'
            }`}>
              {mlAvailable
                ? <><BrainCircuit className="w-3.5 h-3.5" /> Ridge ML</>
                : <><FlaskConical className="w-3.5 h-3.5" /> CPCB Formula</>
              }
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px h-28 bg-white/25" />

        {/* Info Panel */}
        <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-6 max-w-xs w-full text-left space-y-3">
          <p className="text-white font-semibold text-lg leading-snug">{level.textInfo}</p>
          <p className="text-white/70 text-sm">{level.advice ?? ''}</p>

          {/* Raw vs ML comparison row */}
          {mlAvailable && rawAqi !== null && mlAqi !== null && (
            <div className="border-t border-white/20 pt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/10 rounded-xl p-2.5">
                <div className="text-white/60 font-medium mb-0.5">CPCB Formula</div>
                <div className="text-white font-mono font-bold text-lg">{rawAqi}</div>
              </div>
              <div className="bg-white/20 rounded-xl p-2.5 border border-white/30">
                <div className="text-white/80 font-medium mb-0.5 flex items-center gap-1">
                  <BrainCircuit className="w-3 h-3" /> ML Corrected
                </div>
                <div className="text-white font-mono font-bold text-lg">{mlAqi}</div>
              </div>
            </div>
          )}

          {/* Model metadata */}
          <div className="border-t border-white/15 pt-3 flex flex-wrap gap-3 text-[11px] text-white/55">
            <span>Model: <span className="text-white/80 font-medium">{modelName}</span></span>
            {modelMae  !== null && modelMae  !== undefined && <span>MAE: <span className="text-white/80 font-medium">{modelMae}</span></span>}
            {modelR2   !== null && modelR2   !== undefined && <span>R²: <span className="text-white/80 font-medium">{modelR2}</span></span>}
          </div>

          <div className="text-xs text-white/50">
            Updated live from ESP32 · polls every 20 s
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AQIHero;
