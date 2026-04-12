import React from 'react';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import LeafLogo from '../components/LeafLogo';
import { Cpu, Database, Wind, Globe2, Github, BookOpen, ExternalLink, Zap } from 'lucide-react';

const Section = ({ label, children }) => (
  <section className="mt-14">
    <div className="text-xs font-bold uppercase tracking-widest text-accent mb-5">{label}</div>
    {children}
  </section>
);

const TechBadge = ({ name, url }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-green-50 border border-green-200 text-sm font-medium text-text-primary hover:border-accent hover:text-accent transition-all group"
  >
    {name}
    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
  </a>
);

const HardwareRow = ({ icon: Icon, label, desc }) => (
  <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-green-50 transition-colors">
    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-accent" />
    </div>
    <div>
      <div className="font-semibold text-text-primary">{label}</div>
      <div className="text-sm text-text-secondary mt-0.5 leading-relaxed">{desc}</div>
    </div>
  </div>
);

const AQIRow = ({ range, cat, color, desc }) => (
  <div className="flex items-center gap-4 py-3 border-b border-green-50 last:border-0">
    <div className={`w-4 h-4 rounded-full flex-shrink-0 ${color}`} />
    <div className="w-20 font-mono text-sm font-semibold text-text-primary">{range}</div>
    <div className="flex-1 font-medium text-text-primary">{cat}</div>
    <div className="text-sm text-text-secondary hidden sm:block">{desc}</div>
  </div>
);

const AboutPage = () => {
  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto mb-16">

        {/* Hero */}
        <div className="text-center py-12">
          <LeafLogo className="w-20 h-20 mx-auto mb-2" />
          <div className="text-3xl font-bold tracking-tight text-gradient-green mb-6">
            AQI Lite
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-text-primary tracking-tight">About AQI Lite</h1>
          <p className="text-text-secondary text-lg mt-4 leading-relaxed max-w-2xl mx-auto">
            A student-built, open-source IoT project designed to make indoor air quality monitoring
            accessible, affordable, and beautiful — powered by ESP32 and Supabase.
          </p>
          <div className="flex justify-center gap-3 mt-6">
            <a href="https://github.com/Arsen1c-18/AQI-lite-IOT-MDM-2-project" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-text-primary hover:bg-black text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-all">
              <Github className="w-4 h-4" /> View on GitHub
            </a>
          </div>
        </div>

        {/* What is AQI */}
        <Section label="What is AQI?">
          <div className="glassmorphism rounded-3xl p-6 md:p-8 border border-green-100">
            <p className="text-text-secondary leading-relaxed mb-6">
              The <strong className="text-text-primary">Air Quality Index (AQI)</strong> is a standardized scale used to report daily air quality.
              It tells you how clean or polluted your air is and what associated health effects might be a concern.
              AQI Lite computes a simplified AQI from PM2.5 particulate matter readings on your ESP32.
            </p>
            <div className="space-y-0 divide-y divide-green-50">
              <AQIRow range="0 – 50" cat="Good" color="bg-[#00e400]" desc="Minimal impact" />
              <AQIRow range="51 – 100" cat="Satisfactory" color="bg-[#9cff00]" desc="Minor breathing discomfort to sensitive people" />
              <AQIRow range="101 – 200" cat="Moderate" color="bg-[#ffff00]" desc="Breathing discomfort to people with lung, asthma and heart diseases" />
              <AQIRow range="201 – 300" cat="Poor" color="bg-[#ff7e00]" desc="Breathing discomfort to most people on prolonged exposure" />
              <AQIRow range="301 – 400" cat="Very Poor" color="bg-[#ff0000]" desc="Respiratory illness on prolonged exposure" />
              <AQIRow range="401+" cat="Severe" color="bg-[#8f3f97]" desc="Affects healthy people and seriously impacts those with existing diseases" />
            </div>
          </div>
        </Section>

        {/* Hardware */}
        <Section label="Hardware & Sensors">
          <div className="glassmorphism rounded-3xl p-4 border border-green-100 space-y-1">
            <HardwareRow icon={Cpu} label="ESP32 Dev Board" desc="The main microcontroller. Reads all sensors, computes AQI, and pushes data to Supabase via HTTPS POST every 5 minutes over Wi-Fi." />
            <HardwareRow icon={Wind} label="PMS5003 / SDS011 — PM2.5 Sensor" desc="Laser particle counter measuring fine particulate matter (PM2.5) in µg/m³. Primary input for AQI calculation." />
            <HardwareRow icon={Zap} label="MH-Z19B — CO₂ Sensor" desc="NDIR (non-dispersive infrared) CO₂ sensor for indoor air quality. Communicates with ESP32 over UART." />
            <HardwareRow icon={Wind} label="DHT22 / SHT31 — Temp & Humidity" desc="Reads ambient temperature (°C) and relative humidity (%). Used for comfort and correlation analysis." />
            <HardwareRow icon={Database} label="Supabase Cloud Backend" desc="Postgres database with realtime subscriptions. Handles all data ingestion, storage, and API access via Row Level Security." />
          </div>
        </Section>

        {/* Tech Stack */}
        <Section label="Technology Stack">
          <div className="glassmorphism rounded-3xl p-6 md:p-8 border border-green-100">
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="font-semibold text-text-primary mb-3">Frontend</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['React 19', 'https://react.dev'],
                    ['Vite 8', 'https://vite.dev'],
                    ['Tailwind CSS v4', 'https://tailwindcss.com'],
                    ['Recharts', 'https://recharts.org'],
                    ['Framer Motion', 'https://www.framer.com/motion/'],
                    ['Lucide Icons', 'https://lucide.dev'],
                  ].map(([n, u]) => <TechBadge key={n} name={n} url={u} />)}
                </div>
              </div>
              <div>
                <div className="font-semibold text-text-primary mb-3">Backend / Cloud</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['Supabase', 'https://supabase.com'],
                    ['PostgreSQL', 'https://www.postgresql.org'],
                    ['Row Level Security', 'https://supabase.com/docs/guides/auth/row-level-security'],
                    ['Realtime API', 'https://supabase.com/docs/guides/realtime'],
                  ].map(([n, u]) => <TechBadge key={n} name={n} url={u} />)}
                </div>
              </div>
              <div>
                <div className="font-semibold text-text-primary mb-3">Embedded / IoT</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['ESP32', 'https://www.espressif.com/en/products/socs/esp32'],
                    ['Arduino / MicroPython', 'https://micropython.org'],
                    ['HTTPS REST', 'https://supabase.com/docs/guides/api'],
                    ['I2C / UART / SPI', '#'],
                  ].map(([n, u]) => <TechBadge key={n} name={n} url={u} />)}
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Project Goals */}
        <Section label="Project Goals">
          <div className="glassmorphism rounded-3xl p-6 md:p-8 border border-green-100 space-y-4 text-text-secondary leading-relaxed">
            <p>AQI Lite was built as part of an <strong className="text-text-primary">IoT & MDM student project</strong> with the following goals:</p>
            <ul className="space-y-2 list-none">
              {[
                'Develop a working end-to-end IoT system from hardware to cloud to UI',
                'Apply real-time database subscriptions with Supabase for live data',
                'Build a production-quality frontend with React + Tailwind CSS v4',
                'Create a modular folder structure: frontend / backend / ml',
                'Leave room for ML-based AQI predictions in a dedicated ml/ module',
              ].map((g, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-accent font-bold mt-0.5">✓</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* Resources */}
        <Section label="Resources & Links">
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { icon: Github, label: 'GitHub Repository', desc: 'Full source code for frontend, backend schema, and ML', href: 'https://github.com/Arsen1c-18/AQI-lite-IOT-MDM-2-project' },
              { icon: BookOpen, label: 'Supabase Docs', desc: 'Postgres, Realtime, and REST API documentation', href: 'https://supabase.com/docs' },
              { icon: Globe2, label: 'EPA AQI Guide', desc: 'Official US EPA Air Quality Index guidelines', href: 'https://www.airnow.gov/aqi/aqi-basics/' },
              { icon: Cpu, label: 'ESP32 Datasheet', desc: 'Technical documentation for the ESP32 microcontroller', href: 'https://www.espressif.com/en/products/socs/esp32' },
            ].map(r => (
              <a
                key={r.label}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="glassmorphism p-5 rounded-2xl border border-green-100 flex gap-4 items-start hover:border-accent hover:-translate-y-0.5 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0 group-hover:bg-accent transition-colors">
                  <r.icon className="w-5 h-5 text-accent group-hover:text-white transition-colors" />
                </div>
                <div>
                  <div className="font-semibold text-text-primary">{r.label}</div>
                  <div className="text-sm text-text-secondary mt-0.5">{r.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </Section>

      </motion.div>
    </Layout>
  );
};

export default AboutPage;
