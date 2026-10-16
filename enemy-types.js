export const ENEMY_TYPES = {
  warrior:  { name: 'Esqueleto guerreiro', hp: 1.65, speed: 0.78, damage: 13, scale: 1.16, color: '#c9bca0', armor: true },
  archer:   { name: 'Esqueleto arqueiro', hp: 0.78, speed: 0.66, damage: 8, scale: 1.02, ranged: true, color: '#b0c5a1' },
  runner:   { name: 'Esqueleto veloz', hp: 0.68, speed: 1.48, damage: 6, scale: 0.90, color: '#d4bd87' },
  guardian: { name: 'Guardião amaldiçoado', hp: 5.5, speed: 0.58, damage: 22, scale: 1.65, boss: true, color: '#dfb88d' },
  skeleton: { name: 'Esqueleto', hp: 1, speed: 1, damage: 9, scale: 1, color: '#b9ad8c' }
};

export function isBossStage(stage) { return stage === 3 || stage === 6 || stage === 8; }

export function createEnemy(type, x, y, stage, rng = Math.random) {
  const def = ENEMY_TYPES[type] || ENEMY_TYPES.skeleton;
  const hpBase = 54 + stage * 4;
  return {
    type, x, y, hp: Math.round(hpBase * def.hp * (def.boss ? 1 + stage * .06 : 1)),
    maxHp: Math.round(hpBase * def.hp * (def.boss ? 1 + stage * .06 : 1)),
    speed: def.speed * (0.62 + Math.min(stage, 8) * .055 + rng() * .13),
    damage: def.damage + Math.floor(stage * (def.boss ? 1.25 : .42)),
    scale: def.scale, ranged: !!def.ranged, boss: !!def.boss,
    angle: rng() * Math.PI * 2, alive: true, chase: false,
    targetX: x, targetY: y, pathAt: 0, attackAt: 0, attackAnim: 0,
    attackHit: false, wanderAt: 0, stepPhase: rng() * 9, flash: 0,
    shotAt: 0, hurtAt: 0, charge: 0, dropKey: false
  };
}

export function chooseEnemyType(stage, rng = Math.random) {
  const roll = rng();
  if (stage >= 4 && roll < .15) return 'runner';
  if (stage >= 2 && roll < .35) return 'archer';
  if (stage >= 2 && roll < .57) return 'warrior';
  return 'skeleton';
}
