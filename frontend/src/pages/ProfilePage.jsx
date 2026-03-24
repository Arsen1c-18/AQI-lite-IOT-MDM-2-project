import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Calendar, MapPin, Activity, Award, LogOut, CheckCircle2, Shield, Sliders, Cloud } from 'lucide-react';

const ProfilePage = () => {
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.last_sign_in_at) {
      const lastSignIn = new Date(user.last_sign_in_at).getTime();
      const now = new Date().getTime();
      // Show toast if signed in within the last 15 seconds
      if (now - lastSignIn < 15000) {
        setShowToast(true);
        const timer = setTimeout(() => setShowToast(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  const handleSignOut = async () => {
    if (signOut) await signOut();
    navigate('/');
  };

  const displayName = user?.user_metadata?.full_name || 'Demo User';
  const displayEmail = user?.email || 'demo@aqilite.io';
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8 mb-16">

        {/* Success Toast */}
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#e8fbe9] border border-green-200 text-green-800 px-6 py-4 rounded-2xl shadow-sm flex items-center gap-3"
          >
            <CheckCircle2 className="w-6 h-6 text-accent" />
            <div>
              <div className="font-bold tracking-tight">Login Successful</div>
              <div className="text-sm opacity-90">Welcome, {displayName}. It is great to have you here!</div>
            </div>
            <button 
              onClick={() => setShowToast(false)} 
              className="ml-auto text-green-600 hover:text-green-800 font-bold px-2 py-1 rounded hover:bg-green-100 transition-colors"
            >
              ✕
            </button>
          </motion.div>
        )}

        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">My Profile</h1>
          <p className="text-text-secondary">View your account details and connected hardware.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Left Column: User Card */}
          <div className="md:col-span-1 space-y-6">
            <div className="glassmorphism p-6 md:p-8 rounded-3xl border border-green-100 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-green-100 border-4 border-white shadow-xl flex items-center justify-center mb-4 relative overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-accent" />
                )}
                <div className="absolute bottom-0 right-0 w-6 h-6 bg-accent rounded-full border-2 border-white flex items-center justify-center z-10">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-text-primary">{displayName}</h2>
              <p className="text-sm text-text-secondary mb-6 justify-center flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> {displayEmail}
              </p>
              
              <div className="w-full flex justify-center px-4 py-3 bg-white/50 rounded-2xl border border-green-50 mb-2">
                <div className="text-center flex flex-col items-center">
                  <span className="text-lg font-bold text-accent">1</span>
                  <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Active Device</span>
                </div>
              </div>
            </div>

            <div className="glassmorphism p-6 rounded-3xl border border-green-100 space-y-4">
              <h3 className="font-semibold text-text-primary flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-accent" /> Account Info
              </h3>
              <div className="flex justify-between items-center text-sm border-b border-green-50 pb-2">
                <span className="text-text-secondary flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Region</span>
                <span className="font-medium text-text-primary">US-East</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Member Since</span>
                <span className="font-medium text-text-primary">Nov 2024</span>
              </div>
            </div>

            <button 
              onClick={handleSignOut}
              className="w-full flex justify-center items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-6 py-3.5 rounded-2xl font-bold shadow-sm transition-colors border border-red-100"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>

          {/* Right Column: Devices & Activity */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Active Devices */}
            <div className="glassmorphism p-6 md:p-8 rounded-3xl border border-green-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-text-primary">Registered Devices</h2>
                <button 
                  onClick={() => setIsAddingDevice(!isAddingDevice)}
                  className="text-sm font-semibold flex items-center gap-1 text-accent hover:text-green-700 transition-colors bg-green-50 px-3 py-1.5 rounded-lg"
                >
                  {isAddingDevice ? 'Cancel' : '+ Add New'}
                </button>
              </div>

              {isAddingDevice && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 p-4 rounded-2xl bg-white border border-green-100 shadow-sm flex flex-col gap-3"
                >
                  <div className="text-sm font-semibold text-text-primary mb-1">Bind New ESP32 Node</div>
                  <input type="text" placeholder="Enter Device UUID" className="w-full bg-gray-50 border border-green-100 rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent text-sm font-mono transition-all" />
                  <input type="text" placeholder="Display Name (e.g. Node Beta)" className="w-full bg-gray-50 border border-green-100 rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent text-sm transition-all" />
                  <button className="w-full bg-accent hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl transition-all shadow-sm mt-1 hover:-translate-y-0.5">
                    Bind Device
                  </button>
                </motion.div>
              )}

              <div className="space-y-4">
                {[
                  { name: 'AQI Lite Node Alpha', id: 'ESP32_A829FC', status: 'Online', aqi: 42, color: 'bg-green-500' },
                ].map((device, i) => (
                  <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-green-50 hover:border-accent hover:shadow-md transition-all group">
                    <div className="flex items-center gap-4">
                      {/* Status Dot */}
                      <div className="relative flex h-3 w-3">
                        {device.status === 'Online' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${device.status === 'Online' ? 'bg-green-500' : 'bg-gray-300'}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-text-primary flex items-center gap-2">
                          {device.name}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${device.status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {device.status}
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary font-mono mt-1 w-fit bg-gray-50 px-2 py-0.5 rounded border border-gray-100">UUID: {device.id}</div>
                      </div>
                    </div>
                    
                    {/* Data Snapshot */}
                    <div className="flex items-center gap-6 border-t md:border-l md:border-t-0 border-green-50 pt-3 md:pt-0 md:pl-6">
                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase text-text-secondary tracking-widest mb-0.5">AQI</div>
                        <div className={`font-mono font-bold ${device.aqi ? 'text-lg text-text-primary' : 'text-gray-400'}`}>
                          {device.aqi ?? '--'}
                        </div>
                      </div>
                      <button className="px-4 py-2 bg-green-50 text-accent font-semibold text-sm rounded-xl group-hover:bg-accent group-hover:text-white transition-colors">
                        Manage
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glassmorphism p-6 md:p-8 rounded-3xl border border-green-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Recent Activity</h2>
                  <p className="text-sm text-text-secondary">Security and interaction logs.</p>
                </div>
              </div>

              <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-green-200 before:to-transparent">
                {[
                  { action: 'Logged in from Windows', time: 'Today, 8:41 PM', icon: Shield },
                  { action: 'Updated settings preferences', time: 'Yesterday, 2:30 PM', icon: Sliders },
                  { action: 'Binded new device: ESP32_CF812A', time: 'Oct 12, 11:00 AM', icon: Cloud },
                ].map((log, i) => (
                  <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-end w-full mx-auto md:w-1/2 md:group-odd:pl-8 md:group-even:pr-8 md:group-odd:text-left md:group-even:text-right pb-6">
                      <div className="p-4 bg-white rounded-2xl border border-green-50 shadow-sm w-full md:w-auto">
                        <div className="font-semibold text-sm text-text-primary">{log.action}</div>
                        <div className="text-xs text-text-secondary mt-1">{log.time}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </motion.div>
    </Layout>
  );
};

export default ProfilePage;
