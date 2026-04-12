import React from 'react';
import { motion } from 'framer-motion';
import { Wind, Shield, Home, Activity } from 'lucide-react';
import { getAqiInfo } from '../utils/constants';

const Recommendations = ({ aqi }) => {
  const currentLevel = getAqiInfo(aqi);
  
  const getAdvice = (category) => {
    switch (category) {
      case 'Good':
        return [
          { icon: Activity, title: 'Safe for outdoor exercise', desc: 'No restrictions for outdoor activities.', color: 'text-success' },
          { icon: Wind, title: 'Open windows', desc: 'Ventilate your home to bring in fresh air.', color: 'text-success' }
        ];
      case 'Satisfactory':
        return [
          { icon: Activity, title: 'Sensitive individuals', desc: 'May experience minor breathing discomfort.', color: 'text-success' },
          { icon: Wind, title: 'Ventilation is OK', desc: 'You can open windows but monitor the trends.', color: 'text-text-secondary' }
        ];
      case 'Moderate':
        return [
          { icon: Activity, title: 'People with conditions', desc: 'Asthma/heart patients should reduce prolonged exertion.', color: 'text-warning' },
          { icon: Wind, title: 'Ventilation is OK', desc: 'You can open windows but monitor the trends.', color: 'text-text-secondary' }
        ];
      case 'Poor':
      case 'Very Poor':
      case 'Severe':
      default:
        return [
          { icon: Shield, title: 'Turn on air purifier', desc: 'Keep windows closed to block pollution.', color: 'text-error' },
          { icon: Home, title: 'Stay indoors', desc: 'Everyone should avoid exertion outdoor.', color: 'text-error' }
        ];
    }
  };

  const adviceList = getAdvice(currentLevel?.category || 'Good');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glassmorphism rounded-3xl p-6 mt-8 flex flex-col h-full"
    >
      <div className="mb-6 flex justify-between items-center">
        <h3 className="font-semibold text-lg text-text-primary">Health Action Plan</h3>
      </div>
      
      <div className="space-y-4 flex-grow flex flex-col justify-center">
        {adviceList.map((advice, idx) => (
          <div key={idx} className={`p-4 rounded-2xl border bg-white/50 border-white/40 hover:bg-white transition-colors duration-300`}>
            <div className="flex gap-4">
              <div className={`mt-1 bg-white p-2 rounded-xl shadow-sm border border-black/5 ${advice.color}`}>
                <advice.icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-text-primary text-sm mb-1">{advice.title}</h4>
                <p className="text-text-secondary text-xs leading-relaxed">{advice.desc}</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button className="text-[11px] font-medium px-3 py-1 bg-black/5 rounded-lg text-text-secondary hover:bg-black/10 transition-colors">Why?</button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default Recommendations;
