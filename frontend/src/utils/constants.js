export const AQI_LEVELS = [
  {
    min: 0, max: 50,
    category: 'Good',
    bgClass: 'bg-gradient-to-br from-green-500 to-emerald-600',
    textClass: 'text-white',
    badgeClass: 'bg-green-100 text-green-700',
    textInfo: 'Air quality is satisfactory. Safe for outdoor activity.',
    advice: 'Safe for outdoor exercise and all activities.'
  },
  {
    min: 51, max: 100,
    category: 'Moderate',
    bgClass: 'bg-gradient-to-br from-yellow-400 to-amber-500',
    textClass: 'text-white',
    badgeClass: 'bg-yellow-100 text-yellow-700',
    textInfo: 'Air quality is acceptable. Sensitive individuals may be affected.',
    advice: 'Unusually sensitive individuals should consider reducing prolonged exertion.'
  },
  {
    min: 101, max: 150,
    category: 'Unhealthy for Sensitive',
    bgClass: 'bg-gradient-to-br from-orange-400 to-orange-600',
    textClass: 'text-white',
    badgeClass: 'bg-orange-100 text-orange-700',
    textInfo: 'Sensitive groups may experience health effects.',
    advice: 'Close windows. Sensitive groups should limit prolonged outdoor exertion.'
  },
  {
    min: 151, max: 200,
    category: 'Unhealthy',
    bgClass: 'bg-gradient-to-br from-red-500 to-red-700',
    textClass: 'text-white',
    badgeClass: 'bg-red-100 text-red-700',
    textInfo: 'Everyone may begin to experience health effects.',
    advice: 'Close windows. Turn on air purifier. Avoid outdoor activity.'
  },
  {
    min: 201, max: 300,
    category: 'Very Unhealthy',
    bgClass: 'bg-gradient-to-br from-purple-500 to-purple-800',
    textClass: 'text-white',
    badgeClass: 'bg-purple-100 text-purple-700',
    textInfo: 'Health alert: serious effects for everyone.',
    advice: 'Stay indoors with windows closed. Run an air purifier on high.'
  },
  {
    min: 301, max: 9999,
    category: 'Hazardous',
    bgClass: 'bg-gradient-to-br from-rose-800 to-rose-950',
    textClass: 'text-white',
    badgeClass: 'bg-rose-100 text-rose-900',
    textInfo: 'Health emergency. Avoid all outdoor activity.',
    advice: 'Do not go outside. Wear a mask indoors if possible.'
  }
];

export const getAqiInfo = (aqi) => {
  if (aqi === null || aqi === undefined) return null;
  return AQI_LEVELS.find((l) => aqi >= l.min && aqi <= l.max) || AQI_LEVELS[0];
};

// ⚠️ Replace this with your actual device UUID from Supabase
export const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'your-device-uuid-here';
