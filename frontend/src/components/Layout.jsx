import React from 'react';
import { Settings, HelpCircle, User } from 'lucide-react';
import { Link } from 'react-router-dom';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-bg-primary bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200 to-slate-50 text-text-primary p-4 md:p-8 lg:p-12 overflow-x-hidden selection:bg-accent/20">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8 md:mb-12 glassmorphism rounded-full px-6 py-3 border border-white/50 sticky top-4 z-50">
          <div className="flex items-center gap-3">
            <Link to="/" className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-blue-400 shadow-inner flex items-center justify-center text-white font-black hover:scale-105 transition-transform">
              A
            </Link>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500">
              Aura <span className="font-medium opacity-60">Sense</span>
            </h1>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-text-secondary">
            <Link to="/" className="hover:text-text-primary transition-colors">Home</Link>
            <Link to="/dashboard" className="text-accent underline underline-offset-4 decoration-2">Dashboard</Link>
            <Link to="#" className="hover:text-text-primary transition-colors">History</Link>
          </div>

          <div className="flex items-center gap-3 text-text-secondary">
            <button className="p-2 rounded-full hover:bg-slate-200/50 transition-colors">
              <HelpCircle className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-slate-200/50 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 ml-2 rounded-full border border-slate-300 overflow-hidden">
              <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                <User className="w-5 h-5 text-slate-500" />
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Main Content */}
        <main>
          {children}
        </main>

      </div>
    </div>
  );
};

export default Layout;
