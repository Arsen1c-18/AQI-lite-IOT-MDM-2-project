import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Cpu, Cloud, Activity, ShieldCheck, ArrowRight, Zap } from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, desc, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="glassmorphism p-6 rounded-3xl hover:-translate-y-1 transition-transform border border-white/20"
  >
    <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center mb-4 text-accent">
      <Icon className="w-6 h-6" />
    </div>
    <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
    <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
  </motion.div>
);

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-bg-primary bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200 to-slate-50 selection:bg-accent/20 overflow-hidden relative">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-accent/5 rounded-full blur-[120px] -z-10 pointer-events-none translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-success/5 rounded-full blur-[100px] -z-10 pointer-events-none -translate-x-1/2 translate-y-1/2" />

      {/* Navigation */}
      <nav className="max-w-[1400px] mx-auto px-6 py-6 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-blue-400 shadow-inner flex items-center justify-center text-white font-black text-xl">
            A
          </div>
          <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500">
            Aura <span className="font-medium opacity-60">Sense</span>
          </span>
        </div>
        <Link 
          to="/dashboard"
          className="hidden md:flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-full bg-white text-text-primary hover:text-accent border border-black/5 shadow-sm transition-all"
        >
          Open Dashboard
        </Link>
      </nav>

      {/* Hero Section */}
      <main className="max-w-[1400px] mx-auto px-6 pt-16 pb-24 md:pt-24 lg:pt-32 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            className="flex flex-col gap-6 max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold uppercase tracking-wider w-fit">
              <Zap className="w-3.5 h-3.5" />
              ESP32 Powered IoT
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-text-primary tracking-tight leading-[1.1]">
              Next-Gen <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-400">Air Quality</span> Monitoring.
            </h1>
            
            <p className="text-lg text-text-secondary leading-relaxed max-w-xl md:text-xl">
              An open-source, edge-to-cloud environmental tracking system. Powered by custom ESP32 hardware, realtime polling, and a robust Postgres backend via Supabase.
            </p>
            
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <Link 
                to="/dashboard"
                className="group flex items-center gap-2 bg-text-primary hover:bg-black text-white px-8 py-4 rounded-full font-semibold transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              >
                Launch Dashboard
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a 
                href="#architecture"
                className="px-8 py-4 rounded-full font-semibold text-text-primary hover:bg-black/5 transition-colors"
              >
                How it Works
              </a>
            </div>
          </motion.div>

          {/* Hero Visual */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="glassmorphism p-6 rounded-[2.5rem] shadow-2xl border border-white/40 rotate-1 hover:rotate-0 transition-transform duration-500">
              <div className="bg-bg-primary rounded-3xl overflow-hidden border border-black/5 shadow-inner p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <div className="w-12 h-3 bg-slate-200 rounded-full mb-2" />
                    <div className="w-32 h-4 bg-slate-300 rounded-full" />
                  </div>
                  <div className="w-12 h-12 rounded-full border-[6px] border-emerald-400 bg-emerald-100 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
                      <div className="w-6 h-6 rounded-full bg-slate-100 mb-4" />
                      <div className="w-16 h-8 bg-slate-200 rounded-lg mb-2" />
                      <div className="w-10 h-3 bg-slate-100 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Floating Badges */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-6 -right-6 glassmorphism px-4 py-3 rounded-2xl shadow-xl border border-white/50 flex items-center gap-3"
            >
              <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
              <span className="font-semibold text-sm">Realtime Sync Active</span>
            </motion.div>
          </motion.div>

        </div>
      </main>

      {/* Features Grid */}
      <section id="architecture" className="max-w-[1400px] mx-auto px-6 py-24 relative z-10 border-t border-black/5">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">Architecture & Hardware</h2>
          <p className="text-text-secondary text-lg">Built with modern web technologies seamlessly talking to low-cost, high-efficiency microcontrollers.</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard 
            icon={Cpu}
            title="ESP32 Microcontroller"
            desc="Reads sensor data natively using I2C/SPI interfaces, handling analog to digital conversion at the edge."
            delay={0.1}
          />
          <FeatureCard 
            icon={Activity}
            title="Precision Sensors"
            desc="Multiplexed readings across PM2.5, CO2, DHT22 (Temp & Humidity) for a complete environmental profile."
            delay={0.2}
          />
          <FeatureCard 
            icon={Cloud}
            title="Supabase Backend"
            desc="Auto-generated REST APIs and Postgres DB handle massive streams of timeseries data instantly."
            delay={0.3}
          />
          <FeatureCard 
            icon={ShieldCheck}
            title="React Dashboard"
            desc="Beautiful, glassmorphic UI built with Vite & Tailwind v4 to view historical and live data streams."
            delay={0.4}
          />
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
