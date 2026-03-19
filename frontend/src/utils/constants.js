export const AQI_LEVELS = [
  { min: 0, max: 50, category: 'Good', color: 'bg-aqi-good', textInfo: 'Safe for outdoor exercise' },
  { min: 51, max: 100, category: 'Moderate', color: 'bg-aqi-moderate', textInfo: 'Acceptable air quality' },
  { min: 101, max: 150, category: 'Unhealthy for Sensitive', color: 'bg-aqi-sensitive', textInfo: 'Sensitive groups should stay indoors' },
  { min: 151, max: 200, category: 'Unhealthy', color: 'bg-aqi-unhealthy', textInfo: 'Everyone may experience health effects' },
  { min: 201, max: 300, category: 'Very Unhealthy', color: 'bg-aqi-very-unhealthy', textInfo: 'Health alert: everyone may experience serious effects' },
  { min: 301, max: 9999, category: 'Hazardous', color: 'bg-aqi-hazardous', textInfo: 'Health warning of emergency conditions' }
];

export const getAqiInfo = (aqi) => {
  if (aqi === null || aqi === undefined) return null;
  return AQI_LEVELS.find((level) => aqi >= level.min && aqi <= level.max) || AQI_LEVELS[0];
};

export const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'your-device-uuid-here'; // ⚠️ Replace this
