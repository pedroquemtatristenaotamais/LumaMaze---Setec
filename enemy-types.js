import { COMBAT_DIFFICULTIES } from './config.js';
import { resolveCombatDifficulty } from './combat-difficulty.js';

export const ENEMY_TYPES = {
  warrior:  { name: 'Esqueleto guerreiro', hp: 1.65, speed: 0.78, damage: 13, scale: 1.16, color: '#c9bca0', armor: true, projectilePattern: 'twin', shotCooldown: 2900, projectileWindup: .62 },
  archer:   { name: 'Esqueleto arqueiro', hp: 0.78, speed: 0.66, damage: 8, scale: 1.02, ranged: true, color: '#d5bd91', projectilePattern: 'arrow', shotCooldown: 1850, projectileWindup: .50 },
  runner:   { name: 'Esqueleto veloz', hp: 0.68, speed: 1.48, damage: 6, scale: 0.90, color: '#d4bd87', projectilePattern: 'needle', shotCooldown: 2400, projectileWindup: .45 },
  wraith:   { name: 'Espectro da cripta', hp: .86, speed: 1.10, damage: 11, scale: 1.08, color: '#e4c88a', attackKind: 'dash', windup: .70, projectilePattern: 'spectral', shotCooldown: 2800, projectileWindup: .65 },
  emberling: { name: 'Incendiário das ruínas', hp: 1.12, speed: .62, damage: 7, scale: .96, ranged: true, color: '#ef985d', attackKind: 'fan', windup: .80, projectilePattern: 'fan', shotCooldown: 2000, projectileWindup: .70 },
  guardian: { name: 'Guardião amaldiçoado', hp: 5.5, speed: 0.58, damage: 22, scale: 1.65, boss: true, color: '#dfb88d', projectilePattern: 'fan', shotCooldown: 2100, projectileWindup: .80 },
  zombie:   { name: 'Zumbi da catacumba', hp: 1.40, speed: .56, damage: 10, scale: 1.10, zombie: true, color: '#b9ad8c', projectilePattern: 'bone', shotCooldown: 2900, projectileWindup: .65 },
  feral:    { name: 'Zumbi feroz', hp: .92, speed: 1.42, damage: 8, scale: .98, zombie: true, color: '#d4bd87', attackKind: 'dash', windup: .56, projectilePattern: 'needle', shotCooldown: 2550, projectileWindup: .50 },
  spitter:  { name: 'Zumbi cuspidor', hp: .95, speed: .55, damage: 9, scale: 1.06, zombie: true, ranged: true, color: '#ef985d', attackKind: 'fan', windup: .72, projectilePattern: 'fan', shotCooldown: 1900, projectileWindup: .65 },
  plagueBoss: { name: 'Arauto da peste', hp: 8, speed: .48, damage: 18, scale: 1.80, zombie: true, boss: true, ranged: true, color: '#dfb88d', attackKind: 'fan', windup: .90, projectilePattern: 'fan', shotCooldown: 1650, projectileWindup: .85 },
  cryptLord: { name: 'Senhor da cripta', hp: 10, speed: .82, damage: 28, scale: 1.90, boss: true, color: '#e4c88a', attackKind: 'dash', windup: .85, projectilePattern: 'spectral', shotCooldown: 1450, projectileWindup: .75 },
  skeleton: { name: 'Esqueleto', hp: 1, speed: 1, damage: 9, scale: 1, color: '#b9ad8c', projectilePattern: 'bone', shotCooldown: 2500, projectileWindup: .55 }
};

export function isBossStage(stage) { return stage === 3 || stage === 6 || stage === 8; }

export function getBossType(stage) {
  if (stage === 3) return 'guardian';
  if (stage === 6) return 'plagueBoss';
  if (stage === 8) return 'cryptLord';
  return null;
}

export function createEnemy(type, x, y, stage, rng = Math.random, combatDifficulty = 'normal') {
  const def = ENEMY_TYPES[type] || ENEMY_TYPES.skeleton;
  if (!ENEMY_TYPES[type]) type = 'skeleton';
  const hpBase = 54 + stage * 4;
  const profile = COMBAT_DIFFICULTIES[resolveCombatDifficulty(null, combatDifficulty)];
  const maxHp = Math.round(hpBase * def.hp * (def.boss ? 1 + stage * .06 : 1) * profile.health);
  const meleeBase = def.boss ? 1450 : type === 'runner' ? 880 : 1100;
  return {
    type, name: def.name, x, y, hp: maxHp, maxHp,
    speed: def.speed * (0.62 + Math.min(stage, 8) * .055 + rng() * .13) * profile.speed,
    damage: Math.max(2, Math.round((def.damage + Math.floor(stage * (def.boss ? 1.25 : .42))) * profile.damage)),
    scale: def.scale, color: def.color, ranged: !!def.ranged, zombie: !!def.zombie, boss: !!def.boss, bossPhase: 1,
    deathLife: 0, deathMax: 0, hitAngle: 0,
    attackKind: def.attackKind || (def.ranged ? 'arrow' : 'melee'),
    windup: Math.max(.40, (def.windup || (def.boss ? .78 : .52)) * profile.windup),
    projectilePattern: def.projectilePattern,
    projectileWindup: Math.max(.40, def.projectileWindup * profile.windup),
    shotCooldown: Math.max(650, (def.shotCooldown - Math.min(stage, 8) * 35) * profile.cooldown),
    meleeCooldown: Math.max(500, meleeBase * profile.cooldown),
    dashCooldown: Math.max(1100, 2400 * profile.cooldown),
    angle: rng() * Math.PI * 2, alive: true, chase: false,
    targetX: x, targetY: y, pathAt: 0, attackAt: 0, attackAnim: 0,
    attackHit: false, wanderAt: 0, stepPhase: rng() * 9, flash: 0,
    shotAt: rng() * 650, hurtAt: 0, charge: 0, chargeAngle: 0, attackAim: 0, attackMode: '',
    sightAt: 0, canSee: false, dropKey: false
  };
}

export function chooseEnemyType(stage, rng = Math.random, region = 0) {
  let roll = rng();
  // Reserve forty percent in every region while retaining low-roll regional encounters.
  if (roll >= .22 && roll < .44) return 'zombie';
  if (roll >= .44 && roll < .55) return 'feral';
  if (roll >= .55 && roll < .62) return 'spitter';
  // Spread the remaining sixty percent across the original encounter table.
  roll = (roll < .22 ? roll : roll - .40) / .60;
  if (region === 3 && roll < .22) return 'emberling';
  if (stage >= 2 && (region === 2 || region === 3) && roll < .48) return 'wraith';
  if (stage >= 3 && region === 4 && roll < .52) return 'emberling';
  if (stage >= 3 && roll < .09) return 'emberling';
  if (stage >= 2 && roll < .18) return 'wraith';
  if (stage >= 4 && roll < .31) return 'runner';
  if (stage >= 2 && roll < .48) return 'archer';
  if (stage >= 2 && roll < .67) return 'warrior';
  return 'skeleton';
}
