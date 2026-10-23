import { COMBAT_DIFFICULTIES } from './config.js';

export function resolveCombatDifficulty(saved, selected = 'normal', continuing = false) {
  const value = continuing && saved ? saved.combatDifficulty : selected;
  return Object.hasOwn(COMBAT_DIFFICULTIES, value) ? value : 'normal';
}

export function getEnemyCount(cols, rows, stage, mode = 'normal') {
  const profile = COMBAT_DIFFICULTIES[resolveCombatDifficulty(null, mode)];
  // Exclude the existing six-tile stone margin; dimensions and generation stay untouched.
  const area = Math.max(1, cols - 12) * Math.max(1, rows - 12);
  return Math.min(160, Math.max(36, Math.round((8 + area / 135 + Math.max(0, stage - 1) * 3.2) * profile.density)));
}
