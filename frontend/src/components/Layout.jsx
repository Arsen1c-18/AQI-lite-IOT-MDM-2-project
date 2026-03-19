import React from 'react';
import { Settings, HelpCircle, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import LeafLogo from './LeafLogo';

const NavLink = ({ to, children }) => {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      className={`transition-colors font-medium ${active
        ? 'text-accent underline underline-offset-4 decoration-2 decoration-accent'
        : 'text-text-secondary hover:text-accent'
      }`}
    >
      {children}
    </Link>
  );
};

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-nature-gradient text-text-primary selection:bg-accent/20">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-12">

        {/* Sticky Navbar */}
        <header className="flex items-center justify-between py-4 md:py-5 mb-8 md:mb-12 glassmorphism rounded-full px-6 sticky top-4 z-50 mt-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <LeafLogo className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <span className="text-xl font-bold tracking-tight text-gradient-green">
              AQI <span className="font-medium opacity-70">Lite</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/history">History</NavLink>
            <NavLink to="/about">About</NavLink>
          </nav>

          <div className="flex items-center gap-2 text-text-secondary">
            <Link to="/about" className="p-2 rounded-full hover:bg-green-100 transition-colors" title="Help">
              <HelpCircle className="w-5 h-5" />
            </Link>
            <Link to="/settings" className="p-2 rounded-full hover:bg-green-100 transition-colors" title="Settings">
              <Settings className="w-5 h-5" />
            </Link>
            <Link to="/profile" className="w-9 h-9 ml-2 rounded-full border-2 border-green-200 bg-green-50 hover:bg-green-100 transition-colors flex items-center justify-center" title="Profile">
              <User className="w-5 h-5 text-text-secondary" />
            </Link>
          </div>
        </header>

        <main>{children}</main>

        {/* Footer */}
        <footer className="mt-16 mb-8 border-t border-green-200 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-text-secondary">
          <div className="flex items-center gap-2">
            <LeafLogo className="w-5 h-5" />
            <span className="font-semibold text-text-primary">AQI Lite</span>
            <span>· ESP32-powered air quality monitoring</span>
          </div>
          <div className="flex gap-6">
            <Link to="/" className="hover:text-accent transition-colors">Home</Link>
            <Link to="/dashboard" className="hover:text-accent transition-colors">Dashboard</Link>
            <Link to="/history" className="hover:text-accent transition-colors">History</Link>
            <Link to="/about" className="hover:text-accent transition-colors">About</Link>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default Layout;
