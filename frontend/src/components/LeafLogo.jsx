import React from 'react';

const LeafLogo = ({ className = 'w-8 h-8' }) => (
  <svg
    className={className}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="AQI Lite leaf logo"
  >
    {/* Outer leaf */}
    <path
      d="M8 32 C8 32, 6 18, 18 10 C26 5, 35 8, 35 8 C35 8, 34 20, 24 27 C16 33, 8 32, 8 32Z"
      fill="url(#leafGradientOuter)"
    />
    {/* Inner lighter leaf accent */}
    <path
      d="M14 30 C14 30, 13 21, 21 15 C26 11, 32 13, 32 13 C32 13, 30 21, 24 26 C19 30, 14 30, 14 30Z"
      fill="url(#leafGradientInner)"
      opacity="0.6"
    />
    {/* Stem */}
    <path
      d="M8 32 C10 27, 14 22, 20 18"
      stroke="#14532d"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Dew drop */}
    <circle cx="8" cy="32" r="2.5" fill="#4ade80" opacity="0.85" />

    <defs>
      <linearGradient id="leafGradientOuter" x1="8" y1="32" x2="35" y2="8" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#15803d" />
        <stop offset="100%" stopColor="#4ade80" />
      </linearGradient>
      <linearGradient id="leafGradientInner" x1="14" y1="30" x2="32" y2="13" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#86efac" />
        <stop offset="100%" stopColor="#d1fae5" />
      </linearGradient>
    </defs>
  </svg>
);

export default LeafLogo;
