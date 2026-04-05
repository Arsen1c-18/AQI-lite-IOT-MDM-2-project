import React, { useState } from 'react';
import Layout from '../components/Layout';
import { motion } from 'framer-motion';
import { Bell, Shield, Smartphone, Sliders, Moon, Cloud, HardDrive, Save, CheckCircle, AlertCircle } from 'lucide-react';
import {
  getDeviceId,
  getDeviceName,
  saveDeviceSettings,
  clearDeviceSettings,
  isValidDeviceId,
} from '../utils/deviceSettings';
import { isSupabaseConfigured } from '../supabaseClient';

// ─── Toggle component ─────────────────────────────────────────────────────────
const SettingToggle = ({ label, desc, storageKey, defaultOn }) => {
  const stored = localStorage.getItem(storageKey);
  const [isOn, setIsOn] = useState(stored !== null ? stored === 'true' : defaultOn);

  const handleToggle = () => {
    const next = !isOn;
    setIsOn(next);
    localStorage.setItem(storageKey, String(next));
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-green-50 last:border-0">
      <div>
        <div className="font-semibold text-text-primary">{label}</div>
        <div className="text-sm text-text-secondary">{desc}</div>
      </div>
      <button
        onClick={handleToggle}
        aria-pressed={isOn}
        className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 duration-300 ${isOn ? 'bg-accent' : 'bg-gray-300'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${isOn ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const SettingsPage = () => {
  const [activeNav, setActiveNav] = useState('Device Settings');

  // Device fields — initialised from localStorage → env → fallback
  const [deviceId,   setDeviceId]   = useState(getDeviceId()   === 'your-device-uuid-here' ? '' : getDeviceId());
  const [deviceName, setDeviceName] = useState(getDeviceName());

  // Save feedback
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saved' | 'error'

  const idValid     = deviceId === '' || isValidDeviceId(deviceId);
  const supabaseOk  = isSupabaseConfigured();

  const handleSave = () => {
    if (deviceId && !isValidDeviceId(deviceId)) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }
    saveDeviceSettings({ deviceId, deviceName });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleExportCSV = () => {
    // Placeholder — replace with actual Supabase query + CSV serializer
    alert('Export CSV: connect to Supabase and query aqi_results for this device.');
  };

  const handleClearCache = () => {
    if (window.confirm('Clear all locally saved settings? This will reset the device ID.')) {
      clearDeviceSettings();
      setDeviceId('');
      setDeviceName('AQI Lite Node');
    }
  };

  const navItems = [
    { icon: Smartphone, label: 'Device Settings' },
    { icon: Bell,       label: 'Notifications'   },
    { icon: Sliders,    label: 'Appearance'       },
    { icon: Shield,     label: 'Privacy & Security' },
  ];

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto mb-16 space-y-8"
      >
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Settings</h1>
          <p className="text-text-secondary">Manage your device preferences and application settings.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">

          {/* Nav */}
          <div className="md:col-span-1 flex flex-col gap-2">
            {navItems.map(nav => (
              <button
                key={nav.label}
                onClick={() => setActiveNav(nav.label)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeNav === nav.label
                    ? 'bg-accent text-white shadow-md shadow-green-100'
                    : 'text-text-secondary hover:bg-green-50 hover:text-accent'
                }`}
              >
                <nav.icon className="w-5 h-5" />
                {nav.label}
              </button>
            ))}
          </div>

          {/* Panel */}
          <div className="md:col-span-2 space-y-6">

            {/* ── Device Connection ── */}
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

              {/* Supabase status banner */}
              {!supabaseOk && (
                <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Supabase credentials not set — running in demo mode. Add{' '}
                  <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
                  <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to your <code>.env</code>.
                </div>
              )}

              <div className="space-y-4">
                {/* Device ID */}
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">
                    Device UUID
                  </label>
                  <input
                    type="text"
                    value={deviceId}
                    onChange={e => setDeviceId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className={`w-full bg-white border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:ring-2 font-mono text-sm transition-colors ${
                      idValid
                        ? 'border-green-200 focus:ring-accent focus:border-transparent'
                        : 'border-red-300 focus:ring-red-400'
                    }`}
                  />
                  {!idValid && (
                    <p className="text-xs text-red-500 mt-1">Must be a valid UUID (8-4-4-4-12 hex).</p>
                  )}
                  <p className="text-xs text-text-secondary mt-2">
                    Copy from your Supabase <code>devices</code> table → <code>device_id</code> column. Saved to localStorage; takes effect on next data fetch.
                  </p>
                </div>

                {/* Device name */}
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">
                    Device Display Name
                  </label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={e => setDeviceName(e.target.value)}
                    placeholder="e.g. Lab Room 204"
                    className="w-full bg-white border border-green-200 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* ── Preferences ── */}
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
                <SettingToggle
                  label="Real-time Subscriptions"
                  desc="Receive live inserts via Supabase WebSockets immediately."
                  storageKey="aqi_pref_realtime"
                  defaultOn={true}
                />
                <SettingToggle
                  label="Health Alerts"
                  desc="Show actionable health recommendations based on AQI level."
                  storageKey="aqi_pref_health_alerts"
                  defaultOn={true}
                />
                <SettingToggle
                  label="Temperature in Fahrenheit"
                  desc="Toggle between Celsius and Fahrenheit globally."
                  storageKey="aqi_pref_fahrenheit"
                  defaultOn={false}
                />
              </div>
            </div>

            {/* ── Data Management ── */}
            <div className="glassmorphism p-6 md:p-8 rounded-3xl border border-green-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-500">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Data Management</h2>
                  <p className="text-sm text-text-secondary">Export readings or reset local settings.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleExportCSV}
                  className="px-5 py-2.5 bg-white border border-green-200 text-text-primary font-semibold rounded-xl hover:bg-green-50 transition-colors"
                >
                  Export CSV
                </button>
                <button
                  onClick={handleClearCache}
                  className="px-5 py-2.5 bg-white border border-red-200 text-red-600 font-semibold rounded-xl hover:bg-red-50 transition-colors"
                >
                  Reset Settings
                </button>
              </div>
            </div>

            {/* ── Save button ── */}
            <div className="flex items-center justify-end gap-4 pt-4">
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                  <CheckCircle className="w-4 h-4" /> Settings saved
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-sm text-red-500 font-medium">
                  <AlertCircle className="w-4 h-4" /> Invalid Device UUID
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={!idValid}
                className="flex items-center gap-2 bg-accent hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-green-200 transition-all hover:-translate-y-0.5"
              >
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
