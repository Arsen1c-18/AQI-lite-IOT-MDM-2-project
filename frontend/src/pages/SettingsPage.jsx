import React, { useState } from 'react';
import Layout from '../components/Layout';
import { motion } from 'framer-motion';
import { Bell, Shield, Smartphone, Sliders, Moon, Cloud, HardDrive, Save } from 'lucide-react';

const SettingToggle = ({ label, desc, defaultOn }) => {
  const [isOn, setIsOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-4 border-b border-green-50 last:border-0">
      <div>
        <div className="font-semibold text-text-primary">{label}</div>
        <div className="text-sm text-text-secondary">{desc}</div>
      </div>
      <button 
        onClick={() => setIsOn(!isOn)}
        className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 duration-300 ${isOn ? 'bg-accent' : 'bg-gray-300'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${isOn ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );
};

const SettingsPage = () => {
  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto mb-16 space-y-8">
        
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Settings</h1>
          <p className="text-text-secondary">Manage your device preferences and application settings.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Settings Nav Area */}
          <div className="md:col-span-1 flex flex-col gap-2">
            {[
              { icon: Smartphone, label: 'Device Settings', active: true },
              { icon: Bell, label: 'Notifications', active: false },
              { icon: Sliders, label: 'Appearance', active: false },
              { icon: Shield, label: 'Privacy & Security', active: false },
            ].map(nav => (
              <button 
                key={nav.label} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  nav.active 
                    ? 'bg-accent text-white shadow-md shadow-green-100' 
                    : 'text-text-secondary hover:bg-green-50 hover:text-accent'
                }`}
              >
                <nav.icon className="w-5 h-5" />
                {nav.label}
              </button>
            ))}
          </div>

          {/* Main Settings Panel */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Device Config */}
            <div className="glassmorphism p-6 md:p-8 rounded-3xl border border-green-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-accent">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Device Connection</h2>
                  <p className="text-sm text-text-secondary">Bind your ESP32 hardware to this dashboard.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">Registered Device ID (UUID)</label>
                  <input 
                    type="text" 
                    defaultValue="d1f4a9b2-3e2c-4c6a-9a8c-4b5b7c8d9c1e"
                    className="w-full bg-white border border-green-200 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-text-secondary mt-2">Find this in your Supabase 'devices' table. Used to filter live feeds.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">Device Display Name</label>
                  <input 
                    type="text" 
                    defaultValue="AQI Lite Node Alpha"
                    className="w-full bg-white border border-green-200 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* General Preferences */}
            <div className="glassmorphism p-6 md:p-8 rounded-3xl border border-green-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-accent">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Preferences</h2>
                  <p className="text-sm text-text-secondary">Customize your dashboard experience.</p>
                </div>
              </div>

              <div className="space-y-2">
                <SettingToggle label="Real-time Subscriptions" desc="Receive live inserts via Supabase WebSockets immediately." defaultOn={true} />
                <SettingToggle label="Health Alerts" desc="Show actionable health recommendations based on AQI level." defaultOn={true} />
                <SettingToggle label="Temperature in Fahrenheit" desc="Toggle between Celsius and Fahrenheit globally." defaultOn={false} />
              </div>
            </div>

            {/* Data Management */}
            <div className="glassmorphism p-6 md:p-8 rounded-3xl border border-green-100">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-500">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-text-primary">Data Management</h2>
                    <p className="text-sm text-text-secondary">Export or clear local cached data.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button className="px-5 py-2.5 bg-white border border-green-200 text-text-primary font-semibold rounded-xl hover:bg-green-50 transition-colors">
                  Export CSV
                </button>
                <button className="px-5 py-2.5 bg-white border border-red-200 text-red-600 font-semibold rounded-xl hover:bg-red-50 transition-colors">
                  Clear Cache
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button className="flex items-center gap-2 bg-accent hover:bg-green-700 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-green-200 transition-all hover:-translate-y-0.5">
                <Save className="w-5 h-5" /> Save Changes
              </button>
            </div>

          </div>
        </div>
      </motion.div>
    </Layout>
  );
};

export default SettingsPage;
