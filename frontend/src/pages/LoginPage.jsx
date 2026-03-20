import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock } from 'lucide-react';
import LeafLogo from '../components/LeafLogo';

const LoginPage = () => {
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    // Placeholder login action leading to Profile
    navigate('/profile');
  };

  return (
    <div className="min-h-screen bg-nature-gradient flex items-center justify-center p-6 relative">
      <Link to="/" className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 text-text-secondary hover:text-accent font-medium transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </Link>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glassmorphism p-8 md:p-10 rounded-[2rem] border border-green-100 shadow-xl text-center">
          <div className="flex flex-col items-center justify-center mb-6 gap-2">
            <LeafLogo className="w-12 h-12" />
            <span className="text-2xl font-bold tracking-tight text-gradient-green">
              AQI Lite
            </span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome Back</h1>
          <p className="text-text-secondary mb-8">Log in to manage your AQI Lite devices.</p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1.5 ml-1">Email Address</label>
              <div className="relative">
                <input 
                  type="email" 
                  placeholder="you@example.com" 
                  className="w-full bg-white border border-green-200 rounded-xl pl-11 pr-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  required
                />
                <Mail className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1.5 ml-1">Password</label>
              <div className="relative">
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full bg-white border border-green-200 rounded-xl pl-11 pr-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  required
                />
                <Lock className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="flex justify-between items-center px-1 py-1">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer hover:text-text-primary">
                <input type="checkbox" className="rounded text-accent focus:ring-accent w-4 h-4 cursor-pointer" />
                Remember me
              </label>
              <a href="#" className="text-sm font-semibold text-accent hover:underline">Forgot password?</a>
            </div>

            <button type="submit" className="w-full bg-accent hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-green-200 hover:-translate-y-0.5 mt-2">
              Sign In
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-green-100"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#e8fbe9] text-text-secondary">Or continue with</span>
            </div>
          </div>

          <button className="w-full bg-white hover:bg-gray-50 border border-green-200 text-text-primary font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow">
            <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>

          <p className="mt-8 text-sm text-text-secondary">
            Don't have an account? <a href="#" className="font-semibold text-accent hover:underline">Sign up for free</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
