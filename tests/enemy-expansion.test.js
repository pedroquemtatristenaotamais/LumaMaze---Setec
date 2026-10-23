import test from 'node:test';
import assert from 'node:assert/strict';
import * as enemies from '../enemy-types.js';
import { getEnemyCount } from '../combat-difficulty.js';
import { DIFFICULTIES, COMBAT_DIFFICULTIES, PLAYER_MOVE_SPEED } from '../config.js';

test('zombie variants spawn with distinct combat roles and initialized animation state', () => {
  const zombie = enemies.createEnemy('zombie', 3, 4, 2, () => .5);
  const feral = enemies.createEnemy('feral', 3, 4, 2, () => .5);
  const spitter = enemies.createEnemy('spitter', 3, 4, 2, () => .5);
  for (const [type, enemy] of [['zombie', zombie], ['feral', feral], ['spitter', spitter]]) {
    assert.equal(enemy.type, type);
    assert.equal(enemy.zombie, true);
    assert.equal(enemy.boss, false);
    assert.ok(enemy.name.length > 0);
    assert.equal(enemy.bossPhase, 1);
    assert.equal(enemy.deathLife, 0);
    assert.equal(enemy.deathMax, 0);
    assert.equal(enemy.hitAngle, 0);
    assert.equal(enemy.hp, enemy.maxHp);
  }
  assert.ok(zombie.hp > feral.hp && zombie.hp > spitter.hp);
  assert.ok(feral.speed > zombie.speed && feral.speed > spitter.speed);
  assert.equal(feral.attackKind, 'dash');
  assert.equal(zombie.ranged, false);
  assert.equal(spitter.ranged, true);
  assert.notEqual(spitter.projectilePattern, zombie.projectilePattern);
});

test('milestone stages select distinct bosses and ordinary stages select none', () => {
  assert.equal(typeof enemies.getBossType, 'function');
  for (const [stage, expected] of [[1, null], [2, null], [3, 'guardian'], [4, null], [5, null], [6, 'plagueBoss'], [7, null], [8, 'cryptLord'], [9, null]]) {
    assert.equal(enemies.getBossType(stage), expected);
    assert.equal(enemies.isBossStage(stage), expected !== null);
  }
  const guardian = enemies.createEnemy('guardian', 1, 1, 6, () => .5);
  const plague = enemies.createEnemy('plagueBoss', 1, 1, 6, () => .5);
  const lord = enemies.createEnemy('cryptLord', 1, 1, 6, () => .5);
  assert.equal(plague.type, 'plagueBoss');
  assert.equal(lord.type, 'cryptLord');
  for (const boss of [guardian, plague, lord]) {
    assert.equal(boss.boss, true);
    assert.equal(boss.bossPhase, 1);
    assert.ok(boss.name.length > 0);
  }
  assert.ok(guardian.hp < plague.hp && plague.hp < lord.hp);
  assert.equal(plague.zombie, true);
  assert.equal(plague.ranged, true);
  assert.equal(lord.attackKind, 'dash');
  assert.ok(new Set([guardian.projectilePattern, plague.projectilePattern, lord.projectilePattern]).size >= 2);
});

test('zombies fill approximately forty percent of each stage and region without replacing regional encounters', () => {
  for (let stage = 1; stage <= 8; stage++) for (const region of [0, 2, 3, 4]) {
    const counts = new Map();
    for (let i = 0; i < 1000; i++) {
      const type = enemies.chooseEnemyType(stage, () => (i + .5) / 1000, region);
      counts.set(type, (counts.get(type) || 0) + 1);
    }
    const zombies = ['zombie', 'feral', 'spitter'].reduce((sum, type) => sum + (counts.get(type) || 0), 0);
    assert.ok(zombies >= 350 && zombies <= 450, `stage ${stage}, region ${region}: ${zombies}/1000 zombies`);
    for (const type of ['zombie', 'feral', 'spitter']) assert.ok(counts.get(type) > 0);
    assert.ok(!counts.has('guardian') && !counts.has('plagueBoss') && !counts.has('cryptLord'));
  }
  assert.equal(enemies.chooseEnemyType(3, () => .05, 2), 'wraith');
  assert.equal(enemies.chooseEnemyType(3, () => .05, 4), 'emberling');
  assert.equal(enemies.chooseEnemyType(1, () => .05, 3), 'emberling');
});

test('the expanded selection keeps every original regular class available late in the campaign', () => {
  const available = new Set();
  for (let i = 0; i < 1000; i++) available.add(enemies.chooseEnemyType(8, () => (i + .5) / 1000, 0));
  for (const type of ['skeleton', 'warrior', 'archer', 'runner', 'wraith', 'emberling']) assert.ok(available.has(type), `${type} remains available`);
});

test('enemy counts scale from an initial crowd to a bounded late campaign horde', () => {
  assert.ok(getEnemyCount(70, 54, 1, 'normal') >= 36);
  assert.ok(getEnemyCount(90, 70, 1, 'normal') >= 36 && getEnemyCount(90, 70, 1, 'normal') <= 45);
  assert.ok(getEnemyCount(110, 86, 1, 'normal') >= 60);
  assert.equal(getEnemyCount(166, 114, 8, 'hard'), 160);
  assert.equal(getEnemyCount(1000, 1000, 99, 'hard'), 160);
  assert.equal(getEnemyCount(90, 70, 1, 'invalid'), getEnemyCount(90, 70, 1, 'normal'));
  for (const size of Object.values(DIFFICULTIES)) for (const mode of Object.keys(COMBAT_DIFFICULTIES)) {
    let previous = 0;
    for (let stage = 1; stage <= 8; stage++) {
      const count = getEnemyCount((size.cols + (stage - 1) * 4) * 2 + 12, (size.rows + (stage - 1) * 2) * 2 + 12, stage, mode);
      assert.ok(count >= 36 && count <= 160);
      assert.ok(count >= previous);
      previous = count;
    }
  }
  assert.ok(getEnemyCount(90, 70, 1, 'easy') < getEnemyCount(90, 70, 1, 'normal'));
  assert.ok(getEnemyCount(90, 70, 1, 'hard') > getEnemyCount(90, 70, 1, 'normal'));
});

test('every enemy retains readable windups on all combat difficulties and existing palette colors', () => {
  const palette = new Set(['#c9bca0', '#d5bd91', '#d4bd87', '#e4c88a', '#ef985d', '#dfb88d', '#b9ad8c']);
  for (const type of ['skeleton', 'warrior', 'archer', 'runner', 'wraith', 'emberling', 'guardian', 'zombie', 'feral', 'spitter', 'plagueBoss', 'cryptLord']) {
    for (const mode of Object.keys(COMBAT_DIFFICULTIES)) {
      const enemy = enemies.createEnemy(type, 1, 1, 8, () => .5, mode);
      assert.equal(enemy.type, type);
      assert.ok(enemy.windup >= .4 && enemy.projectileWindup >= .4, `${type} in ${mode}`);
      assert.ok(palette.has(enemy.color));
      assert.ok(enemy.hp > 0 && enemy.damage > 0 && enemy.speed > 0);
    }
  }
  const fallback = enemies.createEnemy('missing', 1, 1, 1, () => .5);
  assert.equal(fallback.type, 'skeleton');
  assert.equal(fallback.zombie, false);
  assert.ok(fallback.name.length > 0);
  assert.equal(PLAYER_MOVE_SPEED, 4.4);
});
