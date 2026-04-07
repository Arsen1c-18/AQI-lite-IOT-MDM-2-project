/**
 * computeAQI.js
 * ─────────────
 * Computes AQI from raw sensor values using India CPCB breakpoints
 * (which align with EPA for PM2.5; CO₂ uses a practical indoor scale).
 *
 * Used by:
 *   • ESP32 firmware side  → send calculated_aqi in POST payload
 *   • Supabase Edge Function → compute server-side on insert
 *   • ML pipeline           → produce "reference AQI" labels from co-located data
 *
 * CPCB PM2.5 sub-index breakpoints (24h avg µg/m³ → AQI):
 *   Source: CPCB AQI Technical Document (2014), Table 2
 */

// ─── PM2.5 Breakpoints (CPCB) ────────────────────────────────────────────────
// Each entry: [C_low, C_high, I_low, I_high]
// C = concentration (µg/m³), I = AQI sub-index
const PM25_BREAKPOINTS = [
  [0,     30,   0,   50],   // Good
  [30,    60,   51,  100],  // Satisfactory
  [60,    90,   101, 200],  // Moderate
  [90,    120,  201, 300],  // Poor
  [120,   250,  301, 400],  // Very Poor
  [250,   500,  401, 500],  // Severe
];

// ─── CO₂ Breakpoints (practical indoor scale, ppm → AQI-style sub-index) ────
// Based on ASHRAE 62.1 / NIOSH guidelines mapped to 0–500 scale
const CO2_BREAKPOINTS = [
  [0,    400,  0,   50],   // Good (outdoor baseline)
  [400,  600,  51,  100],  // Satisfactory
  [600,  1000, 101, 200],  // Moderate (ventilation concern)
  [1000, 1500, 201, 300],  // Poor
  [1500, 2500, 301, 400],  // Very Poor
  [2500, 5000, 401, 500],  // Severe (occupational limit approaching)
];

// ─── AQI Category Labels ─────────────────────────────────────────────────────
const AQI_CATEGORIES = [
  { max: 50,  label: 'Good',          color: '#22c55e' },
  { max: 100, label: 'Satisfactory',  color: '#84cc16' },
  { max: 200, label: 'Moderate',      color: '#eab308' },
  { max: 300, label: 'Poor',          color: '#f97316' },
  { max: 400, label: 'Very Poor',     color: '#ef4444' },
  { max: 500, label: 'Severe',        color: '#7f1d1d' },
];

// ─── Linear interpolation ────────────────────────────────────────────────────
function linearInterp(C, C_lo, C_hi, I_lo, I_hi) {
  return Math.round(((I_hi - I_lo) / (C_hi - C_lo)) * (C - C_lo) + I_lo);
}

// ─── Sub-index calculator ────────────────────────────────────────────────────
function subIndex(value, breakpoints) {
  if (value == null || isNaN(value)) return null;

  const clamped = Math.max(0, value);

  for (const [C_lo, C_hi, I_lo, I_hi] of breakpoints) {
    if (clamped >= C_lo && clamped <= C_hi) {
      return linearInterp(clamped, C_lo, C_hi, I_lo, I_hi);
    }
  }

  // Above highest breakpoint → cap at 500
  return 500;
}

// ─── Category lookup ─────────────────────────────────────────────────────────
export function getCategory(aqi) {
  for (const cat of AQI_CATEGORIES) {
    if (aqi <= cat.max) return cat;
  }
  return AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
}

// ─── Main export ─────────────────────────────────────────────────────────────
/**
 * computeAQI({ pm25, co2 })
 *
 * Returns:
 *   {
 *     calculated_aqi: number,      // overall AQI (max of all sub-indices)
 *     pm25_aqi:       number|null, // PM2.5 sub-index
 *     co2_aqi:        number|null, // CO2 sub-index
 *     main_pollutant: string,      // dominant pollutant
 *     category:       string,      // CPCB category label
 *     color:          string,      // hex color for UI
 *   }
 */
export function computeAQI({ pm25 = null, co2 = null } = {}) {
  const pm25Idx = subIndex(pm25, PM25_BREAKPOINTS);
  const co2Idx  = subIndex(co2,  CO2_BREAKPOINTS);

  // Overall AQI = maximum sub-index (CPCB methodology)
  const subIndices = [pm25Idx, co2Idx].filter(v => v !== null);

  if (subIndices.length === 0) {
    return {
      calculated_aqi: null,
      pm25_aqi:        null,
      co2_aqi:         null,
      main_pollutant:  null,
      category:        'Unknown',
      color:           '#94a3b8',
    };
  }

  const calculated_aqi = Math.max(...subIndices);

  // Dominant pollutant = the one with the highest sub-index
  let main_pollutant = 'PM2.5';
  if (co2Idx !== null && (pm25Idx === null || co2Idx > pm25Idx)) {
    main_pollutant = 'CO₂';
  }

  const { label: category, color } = getCategory(calculated_aqi);

  return {
    calculated_aqi,
    pm25_aqi: pm25Idx,
    co2_aqi:  co2Idx,
    main_pollutant,
    category,
    color,
  };
}

// ─── CommonJS export for Node / Edge Function environments ───────────────────
// (Supabase Edge Functions run Deno, which supports ES modules natively —
//  this block is only needed if you bundle for a CJS target)
if (typeof module !== 'undefined') {
  module.exports = { computeAQI, getCategory };
}
