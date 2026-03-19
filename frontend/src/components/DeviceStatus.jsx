import React, { useEffect, useState } from 'react';
import { Wifi, Cpu, Battery, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const DeviceStatus = ({ lastSeen, deviceName, isOnline }) => {
  const [timeAgo, setTimeAgo] = useState('just now');

  useEffect(() => {
    if (!lastSeen) return;
    const interval = setInterval(() => {
      const diff = Math.floor((new Date() - new Date(lastSeen)) / 1000);
      if (diff < 60) setTimeAgo(`${diff}s ago`);
      else if (diff < 3600) setTimeAgo(`${Math.floor(diff / 60)}m ago`);
      else setTimeAgo(`${Math.floor(diff / 3600)}h ago`);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastSeen]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glassmorphism rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between"
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg text-text-primary">{deviceName || 'Main Sensor Node'}</h3>
            {isOnline && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            <span>ESP32-WROOM-32</span>
          </p>
        </div>
        
        <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${isOnline ? 'bg-success/10 text-success border-success/20' : 'bg-text-secondary/10 text-text-secondary border-text-secondary/20'}`}>
          {isOnline ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-auto">
        <div className="bg-bg-primary/50 rounded-xl p-3 border border-white/40">
          <div className="flex items-center gap-2 text-text-secondary mb-1">
            <Wifi className="w-4 h-4" />
            <span className="text-xs font-medium">Signal</span>
          </div>
          <div className="text-sm font-semibold">Excellent (-45dBm)</div>
        </div>
        
        <div className="bg-bg-primary/50 rounded-xl p-3 border border-white/40">
          <div className="flex items-center gap-2 text-text-secondary mb-1">
            <Battery className="w-4 h-4" />
            <span className="text-xs font-medium">Power</span>
          </div>
          <div className="text-sm font-semibold">Mains connected</div>
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-between text-xs text-text-secondary border-t border-black/5 pt-3">
        <span>Last synced: {timeAgo}</span>
        <button className="flex items-center hover:text-accent transition-colors">
          <span>Details</span>
          <ChevronRight className="w-3 h-3 ml-0.5" />
        </button>
      </div>
    </motion.div>
  );
};

export default DeviceStatus;
