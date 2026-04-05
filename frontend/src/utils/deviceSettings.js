/**
 * deviceSettings.js
 * ──────────────────
 * Single source of truth for device ID and display name.
 *
 * Priority (highest → lowest):
 *   1. User-saved value in localStorage  (set from SettingsPage)
 *   2. VITE_DEVICE_ID env var            (build-time default)
 *   3. Sentinel value → triggers demo mode
 *
 * Both useAQIData and useRealtime import getDeviceId() from here
 * so saving in Settings takes effect on next poll / page load.
 */

const STORAGE_KEY_DEVICE_ID   = 'aqi_lite_device_id';
const STORAGE_KEY_DEVICE_NAME = 'aqi_lite_device_name';
const SENTINEL                = 'your-device-uuid-here';

// ── Getters ──────────────────────────────────────────────────────────────────

export function getDeviceId() {
  return (
    localStorage.getItem(STORAGE_KEY_DEVICE_ID) ||
    import.meta.env.VITE_DEVICE_ID ||
    SENTINEL
  );
}

export function getDeviceName() {
  return (
    localStorage.getItem(STORAGE_KEY_DEVICE_NAME) ||
    'AQI Lite Node'
  );
}

// ── Setters ──────────────────────────────────────────────────────────────────

export function saveDeviceSettings({ deviceId, deviceName }) {
  if (deviceId)   localStorage.setItem(STORAGE_KEY_DEVICE_ID,   deviceId.trim());
  if (deviceName) localStorage.setItem(STORAGE_KEY_DEVICE_NAME, deviceName.trim());
}

export function clearDeviceSettings() {
  localStorage.removeItem(STORAGE_KEY_DEVICE_ID);
  localStorage.removeItem(STORAGE_KEY_DEVICE_NAME);
}

// ── Validation ────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidDeviceId(id) {
  return UUID_RE.test(id ?? '');
}
