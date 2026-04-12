export const AQI_LEVELS = [
  {
    min: 0, max: 50,
    category: 'Good',
    bgClass: 'bg-[#00e400]',
    textClass: 'text-black',
    badgeClass: 'bg-[#00e400]/20 text-[#006600]',
    textInfo: 'Minimal impact',
    advice: 'No restrictions for outdoor activities.'
  },
  {
    min: 51, max: 100,
    category: 'Satisfactory',
    bgClass: 'bg-[#9cff00]',
    textClass: 'text-black',
    badgeClass: 'bg-[#9cff00]/20 text-[#4a8000]',
    textInfo: 'Minor breathing discomfort to sensitive people',
    advice: 'Sensitive individuals should monitor their health.'
  },
  {
    min: 101, max: 200,
    category: 'Moderate',
    bgClass: 'bg-[#ffff00]',
    textClass: 'text-black',
    badgeClass: 'bg-[#ffff00]/30 text-[#808000]',
    textInfo: 'Breathing discomfort to people with lung, asthma and heart diseases',
    advice: 'Asthma and heart patients should reduce prolonged exertion.'
  },
  {
    min: 201, max: 300,
    category: 'Poor',
    bgClass: 'bg-[#ff7e00]',
    textClass: 'text-white',
    badgeClass: 'bg-[#ff7e00]/20 text-[#cc6500]',
    textInfo: 'Breathing discomfort to most people on prolonged exposure',
    advice: 'Everyone should reduce outdoor activities.'
  },
  {
    min: 301, max: 400,
    category: 'Very Poor',
    bgClass: 'bg-[#ff0000]',
    textClass: 'text-white',
    badgeClass: 'bg-[#ff0000]/20 text-[#cc0000]',
    textInfo: 'Respiratory illness on prolonged exposure',
    advice: 'Avoid all outdoor physical activities.'
  },
  {
    min: 401, max: 9999,
    category: 'Severe',
    bgClass: 'bg-[#8f3f97]',
    textClass: 'text-white',
    badgeClass: 'bg-[#8f3f97]/20 text-[#8f3f97]',
    textInfo: 'Affects healthy people and seriously impacts those with existing diseases',
    advice: 'Stay indoors and keep activity levels low.'
  }
];

export const getAqiInfo = (aqi) => {
  if (aqi === null || aqi === undefined) return null;
  return AQI_LEVELS.find((l) => aqi >= l.min && aqi <= l.max) || AQI_LEVELS[5];
};

