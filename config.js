// Central place to tune campaign size and weapon balance.
export const DIFFICULTIES = {
  easy:   { cols: 29, rows: 21, coins: 7, label: 'CATACUMBAS', status: 'NAS CATACUMBAS' },
  normal: { cols: 39, rows: 29, coins: 10, label: 'CRIPTA', status: 'DENTRO DA CRIPTA' },
  hard:   { cols: 49, rows: 37, coins: 14, label: 'ABISMO', status: 'NO FUNDO DO ABISMO' }
};

export const MAX_STAGES = 8;
export const PLAYER_MOVE_SPEED = 4.4; // 10% above the original 4 tiles/second.

// Combat is independent of DIFFICULTIES, which continues to describe map sizes.
export const COMBAT_DIFFICULTIES = {
  easy: { label: 'FÁCIL', density: .72, speed: 1.15, damage: .58, health: .82, cooldown: .90, projectileSpeed: .95, windup: 1.12 },
  normal: { label: 'MÉDIO', density: 1, speed: 1.45, damage: .85, health: 1, cooldown: .70, projectileSpeed: 1.10, windup: 1 },
  hard: { label: 'DIFÍCIL', density: 1.25, speed: 1.75, damage: 1.15, health: 1.12, cooldown: .55, projectileSpeed: 1.20, windup: .88 }
};

export const WEAPONS = {
  pistol:  { name: 'PISTOLA', magazine: 12, reserve: 96, damage: 42, rate: 260, speed: 20, range: 27, spread: .025, pellets: 1, color: '#ffd88a', sound: 'pistol', bounces: 4 },
  shotgun: { name: 'SHOTGUN', magazine: 6, reserve: 48, damage: 18, rate: 720, speed: 17, range: 19, spread: .29, pellets: 8, color: '#ffb45c', sound: 'shotgun', bounces: 3 },
  ak:      { name: 'AK-47', magazine: 30, reserve: 180, damage: 23, rate: 105, speed: 24, range: 34, spread: .075, pellets: 1, color: '#ff9252', sound: 'ak', bounces: 5 }
};
