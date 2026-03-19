import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Cpu, Cloud, Activity, ShieldCheck, ArrowRight, Zap, Wind, Thermometer, Droplets, BarChart3 } from 'lucide-react';
import LeafLogo from '../components/LeafLogo';

const FeatureCard = ({ icon: Icon, title, desc, delay, accent = false }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className={`rounded-3xl p-6 border transition-all hover:-translate-y-1 duration-300 ${
      accent
        ? 'bg-accent text-white border-accent/0 shadow-lg shadow-green-200'
        : 'glassmorphism border-white/40'
    }`}
  >
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${accent ? 'bg-white/20' : 'bg-green-100'}`}>
      <Icon className={`w-6 h-6 ${accent ? 'text-white' : 'text-accent'}`} />
    </div>
    <h3 className={`text-lg font-semibold mb-2 ${accent ? 'text-white' : 'text-text-primary'}`}>{title}</h3>
    <p className={`text-sm leading-relaxed ${accent ? 'text-white/80' : 'text-text-secondary'}`}>{desc}</p>
  </motion.div>
);

const StatBadge = ({ value, label }) => (
  <div className="glassmorphism rounded-2xl px-5 py-3 text-center">
    <div className="text-2xl font-bold text-gradient-green font-mono">{value}</div>
    <div className="text-xs text-text-secondary mt-0.5 font-medium uppercase tracking-wide">{label}</div>
  </div>
);

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-nature-gradient overflow-hidden relative">

      {/* Ambient background blobs */}
      <div className="fixed top-0 right-0 w-[700px] h-[700px] bg-green-300/20 rounded-full blur-[120px] -z-10 pointer-events-none translate-x-1/3 -translate-y-1/3" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-emerald-400/15 rounded-full blur-[100px] -z-10 pointer-events-none -translate-x-1/3 translate-y-1/3" />

      {/* Navigation */}
      <nav className="max-w-[1400px] mx-auto px-6 pt-6 flex justify-between items-center relative z-10">
        <Link to="/" className="flex items-center gap-2.5">
          <LeafLogo className="w-9 h-9" />
          <span className="text-2xl font-bold tracking-tight text-gradient-green">
            AQI <span className="font-medium opacity-70">Lite</span>
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm text-text-secondary font-medium">
          <Link to="/" className="text-accent">Home</Link>
          <Link to="/dashboard" className="hover:text-accent transition-colors">Dashboard</Link>
          <Link to="/history" className="hover:text-accent transition-colors">History</Link>
          <Link to="/about" className="hover:text-accent transition-colors">About</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden md:flex items-center text-text-primary hover:bg-green-100 font-semibold px-5 py-2.5 rounded-full text-sm transition-all"
          >
            Log In
          </Link>
          <Link
            to="/dashboard"
            className="hidden md:flex items-center gap-2 bg-accent hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-full text-sm transition-all shadow-md shadow-green-200"
          >
            Open Dashboard
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-[1400px] mx-auto px-6 pt-16 pb-20 md:pt-24 lg:pt-32 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            className="flex flex-col gap-6 max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-green-100 border border-green-200 text-accent text-xs font-bold uppercase tracking-wider w-fit">
              <Zap className="w-3.5 h-3.5" />
              ESP32 Powered · Open Source IoT
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-text-primary tracking-tight leading-[1.05]">
              Breathe smarter,<br />
              <span className="text-gradient-green">live greener.</span>
            </h1>

            <p className="text-lg md:text-xl text-text-secondary leading-relaxed max-w-xl">
              AQI Lite is an open-source air quality monitor powered by an ESP32 microcontroller.
              Track PM2.5, CO₂, Temperature, and Humidity in real‑time — right from your browser.
            </p>

            <div className="flex flex-wrap gap-4 mt-2">
              <Link
                to="/dashboard"
                className="group flex items-center gap-2 bg-accent hover:bg-green-700 text-white px-8 py-4 rounded-full font-semibold transition-all shadow-xl shadow-green-200 hover:-translate-y-0.5"
              >
                Launch Dashboard
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#how-it-works"
                className="px-8 py-4 rounded-full font-semibold text-text-primary hover:bg-green-100 transition-colors border border-green-200"
              >
                How it Works
              </a>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-3 mt-4">
              <StatBadge value="4" label="Sensors" />
              <StatBadge value="5min" label="Update Rate" />
              <StatBadge value="24hr" label="History" />
              <StatBadge value="100%" label="Open Source" />
            </div>
          </motion.div>

          {/* Right: Visual Mock */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="glassmorphism p-5 rounded-[2.5rem] shadow-2xl border border-green-100 rotate-1 hover:rotate-0 transition-transform duration-500">
              <div className="bg-green-50 rounded-3xl overflow-hidden border border-green-100 shadow-inner p-7">
                {/* Mock AQI card */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white mb-4 shadow-lg">
                  <div className="text-sm font-medium opacity-80 uppercase tracking-wider mb-1">Air Quality Index</div>
                  <div className="text-7xl font-bold font-mono tracking-tighter">42</div>
                  <div className="text-2xl font-semibold mt-1">Good</div>
                  <div className="text-sm opacity-80 mt-2">Safe for outdoor exercise ✓</div>
                </div>
                {/* Mock sensor cards */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'PM2.5', value: '12.5', unit: 'µg/m³', color: 'bg-red-50 text-red-600' },
                    { label: 'CO₂', value: '410', unit: 'ppm', color: 'bg-blue-50 text-blue-600' },
                    { label: 'Temp', value: '22.4', unit: '°C', color: 'bg-orange-50 text-orange-600' },
                    { label: 'Humidity', value: '48', unit: '%', color: 'bg-cyan-50 text-cyan-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl p-3.5 border border-green-50">
                      <div className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">{s.label}</div>
                      <div className={`text-xl font-bold font-mono ${s.color.split(' ')[1]}`}>{s.value}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{s.unit}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-5 -right-5 glassmorphism px-4 py-2.5 rounded-2xl shadow-xl border border-green-200 flex items-center gap-2.5"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="font-semibold text-sm text-text-primary">Live Sync Active</span>
            </motion.div>

            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute -bottom-4 -left-4 glassmorphism px-4 py-2.5 rounded-2xl shadow-xl border border-green-200 flex items-center gap-2"
            >
              <Wind className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-text-primary">ESP32 Online</span>
            </motion.div>
          </motion.div>

        </div>
      </main>

      {/* How It Works */}
      <section id="how-it-works" className="max-w-[1400px] mx-auto px-6 py-24 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-accent">How it works</span>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mt-3 mb-4">From sensor to screen</h2>
          <p className="text-text-secondary text-lg">The full pipeline — from physical air particles to your browser, in under 5 seconds.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          <FeatureCard icon={Cpu} title="ESP32 Microcontroller" desc="The heart of AQI Lite. Reads sensors via I2C/SPI, calculates AQI, and pushes data to the cloud every 5 minutes." delay={0.1} accent />
          <FeatureCard icon={Activity} title="Precision Sensors" desc="PM2.5 (particulate), CO₂ (MH-Z19), DHT22 (temperature & humidity) — a comprehensive indoor air profile." delay={0.2} />
          <FeatureCard icon={Cloud} title="Supabase Backend" desc="Real-time Postgres database with auto-generated REST API. All data flows through Row Level Security policies." delay={0.3} />
          <FeatureCard icon={BarChart3} title="React Dashboard" desc="Live charts, sensor cards, health recommendations, and 24h trend history — all built with Vite + Tailwind v4." delay={0.4} />
        </div>
      </section>

      {/* Sensor preview strip */}
      <section className="max-w-[1400px] mx-auto px-6 pb-20 relative z-10">
        <div className="glassmorphism rounded-3xl p-8 border border-green-100 grid md:grid-cols-4 gap-6 text-center">
          {[
            { icon: Wind, label: 'PM2.5 Particulate', desc: 'Fine particle matter in µg/m³', color: 'text-red-500' },
            { icon: Activity, label: 'CO₂ Level', desc: 'Carbon dioxide in ppm', color: 'text-blue-500' },
            { icon: Thermometer, label: 'Temperature', desc: 'Ambient temp in °C', color: 'text-orange-500' },
            { icon: Droplets, label: 'Humidity', desc: 'Relative humidity %', color: 'text-cyan-500' },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center">
                <s.icon className={`w-7 h-7 ${s.color}`} />
              </div>
              <div className="font-semibold text-text-primary">{s.label}</div>
              <div className="text-sm text-text-secondary">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[900px] mx-auto px-6 pb-28 text-center relative z-10">
        <div className="bg-gradient-to-br from-accent to-green-600 rounded-3xl p-12 text-white shadow-2xl shadow-green-200">
          <LeafLogo className="w-14 h-14 mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to monitor your air?</h2>
          <p className="text-white/80 max-w-md mx-auto mb-8 text-lg">Connect your ESP32 device and start tracking air quality in minutes. Open source, forever free.</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 bg-white text-accent px-8 py-4 rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
          >
            View Live Dashboard <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-[1400px] mx-auto px-6 pb-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-text-secondary border-t border-green-200 pt-8">
        <div className="flex items-center gap-2">
          <LeafLogo className="w-5 h-5" />
          <span className="font-semibold text-text-primary">AQI Lite</span>
          <span>© 2025 · Open Source IoT Project</span>
        </div>
        <div className="flex gap-6">
          <Link to="/dashboard" className="hover:text-accent">Dashboard</Link>
          <Link to="/history" className="hover:text-accent">History</Link>
          <Link to="/about" className="hover:text-accent">About</Link>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
