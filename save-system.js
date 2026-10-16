const SAVE_KEY = 'ultima-chama-campaign-v2';
const SETTINGS_KEY = 'ultima-chama-settings-v1';

export function loadCampaignSave() {
  try {
    const value = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!value || !Number.isInteger(value.stage) || value.stage < 1 || value.stage > 8) return null;
    return value;
  } catch { return null; }
}

export function saveCampaign(value) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(value)); return true; }
  catch { return false; }
}

export function clearCampaignSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage may be disabled */ }
}

export function loadSettings() {
  const defaults = { sound: true, volume: 0.65, brightness: 0.5, reducedMotion: false };
  try { return { ...defaults, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')) }; }
  catch { return defaults; }
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* optional */ }
}
