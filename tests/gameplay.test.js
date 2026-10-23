import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeMaze, widenMaze } from '../maze-generator.js';
import { DIFFICULTIES } from '../config.js';
import { createEnemy, chooseEnemyType } from '../enemy-types.js';

const navigation = await import('../pathfinding.js').catch(() => ({}));

function flood(grid, startX = 1, startY = 1) {
  const seen = new Set([`${startX},${startY}`]);
  const queue = [[startX, startY]];
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      if (grid[ny]?.[nx] === undefined || grid[ny][nx] === 1 || seen.has(key)) continue;
      seen.add(key); queue.push([nx, ny]);
    }
  }
  return seen;
}

test('maze generation consumes the supplied random source and reproduces its layout', () => {
  let draws = 0;
  const constant = () => { draws++; return .42; };
  const first = makeMaze(29, 21, 1, constant);
  assert.ok(draws > 0, 'the supplied random source must control generation');
  assert.deepEqual(makeMaze(29, 21, 1, () => .42), first);
});

test('numeric seeds reproduce layouts while different seeds produce different routes', () => {
  assert.deepEqual(makeMaze(39, 29, 4, 2026), makeMaze(39, 29, 4, 2026));
  assert.notDeepEqual(makeMaze(39, 29, 4, 2026), makeMaze(39, 29, 4, 2027));
});

test('all three sizes and eight stages keep floors, themed regions and exit connected', () => {
  for (const size of Object.values(DIFFICULTIES)) for (let stage = 1; stage <= 8; stage++) {
    const width = size.cols + (stage - 1) * 4, height = size.rows + (stage - 1) * 2;
    for (const seed of [1, 77, 2026]) {
      const grid = makeMaze(width, height, stage, seed), reached = flood(grid);
      assert.equal(reached.size, grid.flat().filter(cell => cell !== 1).length);
      assert.ok(reached.has(`${width - 2},${height - 2}`));
      assert.ok(grid[0].every(cell => cell === 1) && grid.at(-1).every(cell => cell === 1));
      assert.ok(grid.every(row => row[0] === 1 && row.at(-1) === 1));
      for (const region of [2, 3, 4]) assert.ok(grid.some(row => row.includes(region)));
      const wide = widenMaze(grid);
      assert.equal(wide.length, height * 2); assert.equal(wide[0].length, width * 2);
      assert.equal(flood(wide, 2, 2).size, reached.size * 4);
    }
  }
});

test('one shared distance field follows a corridor around a wall', () => {
  assert.equal(typeof navigation.createDistanceField, 'function', 'shared navigation must be available');
  const grid = ['1111111', '1000001', '1011101', '1000101', '1111111'].map(row => [...row].map(Number));
  let reads = 0;
  const field = navigation.createDistanceField(7, 5, (x, y) => { reads++; return grid[y]?.[x] === 0; });
  field.rebuild(5, 3);
  assert.equal(field.distanceAt(1, 3), 8);
  assert.deepEqual(field.nextStep(1.5, 3.5), { x: 1.5, y: 2.5 });
  const rebuildReads = reads;
  for (let i = 0; i < 100; i++) field.nextStep(1.5, 3.5);
  assert.equal(reads, rebuildReads, 'followers must reuse the field without running another search');
});

test('closed doors block routes and rebuilding after opening restores them', () => {
  assert.equal(typeof navigation.createDistanceField, 'function', 'shared navigation must be available');
  let doorOpen = false;
  const field = navigation.createDistanceField(5, 3, (x, y) => y === 1 && x > 0 && x < 4 && (x !== 2 || doorOpen));
  field.rebuild(3, 1);
  assert.equal(field.distanceAt(1, 1), -1);
  assert.equal(field.nextStep(1.5, 1.5), null);
  doorOpen = true; field.rebuild(3, 1);
  assert.equal(field.distanceAt(1, 1), 2);
  assert.deepEqual(field.nextStep(1.5, 1.5), { x: 2.5, y: 1.5 });
  assert.deepEqual(field.nextStep(2.5, 1.5, true), { x: 1.5, y: 1.5 });
  assert.equal(field.distanceAt(-1, 1), -1);
});

test('regional enemies have different attack styles and remain available in their regions', () => {
  const wraith = createEnemy('wraith', 3, 4, 3, () => .5);
  const emberling = createEnemy('emberling', 6, 7, 3, () => .5);
  assert.equal(wraith.attackKind, 'dash'); assert.equal(wraith.ranged, false);
  assert.equal(emberling.attackKind, 'fan'); assert.equal(emberling.ranged, true);
  assert.ok(wraith.windup >= .5 && emberling.windup >= .5, 'new attacks need readable windups');
  assert.equal(chooseEnemyType(3, () => .05, 2), 'wraith');
  assert.equal(chooseEnemyType(3, () => .05, 4), 'emberling');
  assert.equal(chooseEnemyType(1, () => .05, 3), 'emberling');
  assert.ok(wraith.hp > 0 && emberling.speed > 0);
});

function functionSource(source, name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  let depth = 0, opened = false;
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    if (source[index] === '{') { depth++; opened = true; }
    if (source[index] === '}' && --depth === 0 && opened) return source.slice(start, index + 1);
  }
  throw new Error(`Cannot read ${name}`);
}

test('switching guns cancels a pending reload before it can fill the wrong magazine', async () => {
  const source = await readFile(new URL('../game.js', import.meta.url), 'utf8');
  const run = new Function('WEAPONS', `
    let running=true, paused=false, reloadTimer=0, currentWeapon='pistol';
    const weaponInventory=new Set(['pistol','ak']);
    const ammo={pistol:{mag:0,reserve:12},ak:{mag:1,reserve:30}};
    const gameStatus={textContent:''}, tone=()=>{}, updateWeaponUI=()=>{}, showPickupToast=()=>{}, setTimeout=()=>{};
    ${functionSource(source, 'reload')}
    ${functionSource(source, 'setWeapon')}
    reload(); setWeapon('ak');
    return {reloadTimer,ammo,currentWeapon,status:gameStatus.textContent};
  `);
  const { WEAPONS } = await import('../config.js');
  const result = run(WEAPONS);
  assert.equal(result.reloadTimer, 0);
  assert.equal(result.ammo.ak.mag, 1); assert.equal(result.ammo.pistol.mag, 0);
  assert.notEqual(result.status, 'RECARREGANDO');
});

async function enemyScenario(grid, enemy, player, frames = 1) {
  const source = await readFile(new URL('../game.js', import.meta.url), 'utf8');
  const functions = ['walkableCell', 'blockedAt', 'moveEntity', 'hasLineOfSight', 'updateEnemies'];
  if (source.includes('  function findPathStep(')) functions.push('findPathStep');
  const run = new Function('maze', 'enemy', 'player', 'createDistanceField', 'frames', `
    const rows=maze.length, cols=maze[0].length, enemies=[enemy], secretDoors=[], hostileBullets=[];
    const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by), clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    const cellKey=(x,y)=>x+','+y, tone=()=>{}, stage=3, MAX_HOSTILE_BULLETS=128;
    let damageCooldown=0, damage=0, navigationDirty=true, lastPathUpdate=-Infinity;
    const damagePlayer=amount=>{damage+=amount; damageCooldown=.72;};
    const navigation=createDistanceField(cols,rows,walkableCell);
    ${functions.map(name => functionSource(source, name)).join('\n')}
    for(let i=0;i<frames;i++) updateEnemies(.02,5000+i*20);
    return {enemy,hostileBullets,damage};
  `);
  return run(grid.map(row => [...row].map(Number)), enemy, player, navigation.createDistanceField, frames);
}

test('an archer follows a corridor when a wall hides a player inside shooting distance', async () => {
  const enemy = createEnemy('archer', 1.5, 3.5, 3, () => .5);
  const result = await enemyScenario(['1111111', '1000001', '1011101', '1000101', '1111111'], enemy, { x: 5.5, y: 3.5 });
  assert.equal(result.enemy.targetY, 2.5);
  assert.ok(result.enemy.y < 3.5);
});

test('a charging wraith stops at a wall instead of passing through it', async () => {
  const enemy = createEnemy('wraith', 2.5, 1.5, 3, () => .5);
  enemy.charge = .45; enemy.chargeAngle = 0; enemy.attackAt = 5000;
  const result = await enemyScenario(['1111111', '1001001', '1111111'], enemy, { x: 5.5, y: 1.5 }, 30);
  assert.ok(result.enemy.x < 2.81 && result.enemy.x >= 2.5);
  assert.equal(result.enemy.charge, 0);
  assert.equal(result.damage, 0);
});

test('an emberling releases its three-shot fan after the visible windup', async () => {
  const enemy = createEnemy('emberling', 1.5, 1.5, 3, () => .5);
  enemy.attackAnim = .03; enemy.attackAim = 0; enemy.shotAt = 5000;
  const before = await enemyScenario(['11111111', '10000001', '11111111'], structuredClone(enemy), { x: 6.5, y: 1.5 });
  assert.equal(before.hostileBullets.length, 0);
  const after = await enemyScenario(['11111111', '10000001', '11111111'], enemy, { x: 6.5, y: 1.5 }, 2);
  assert.equal(after.hostileBullets.length, 3);
  assert.ok(after.hostileBullets[0].vy < 0 && after.hostileBullets[2].vy > 0);
});

test('melee windups cannot damage a player through a diagonal wall corner', async () => {
  const enemy = createEnemy('skeleton', 1.78, 1.78, 3, () => .5);
  enemy.attackAnim = .30; enemy.attackAt = 5000;
  const result = await enemyScenario(['1111', '1011', '1101', '1111'], enemy, { x: 2.22, y: 2.22 }, 20);
  assert.equal(result.damage, 0);
});

test('regional encounters appear from the first stage and keep a safe start and weapon radius', async () => {
  const source = await readFile(new URL('../game.js', import.meta.url), 'utf8');
  const { isBossStage } = await import('../enemy-types.js');
  const run = new Function('maze', 'stage', 'createEnemy', 'chooseEnemyType', 'isBossStage', `
    const cols=maze[0].length, rows=maze.length, player={x:8.5,y:8.5}, exit={x:cols-9,y:rows-9};
    const difficulty='normal',secretRooms=[],MAX_ENEMIES=64;
    const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by),randInt=max=>Math.floor(Math.random()*max);
    let enemies=[],weaponPickups=[];
    ${['openCells', 'placeWeaponPickups', 'spawnEnemies'].map(name => functionSource(source, name)).join('\n')}
    weaponPickups=placeWeaponPickups(); spawnEnemies();
    return {enemies,weaponPickups};
  `);
  for (const stage of [1, 2, 3, 8, 99]) {
    const built = widenMaze(makeMaze(49, 37, stage, 99));
    const maze = Array.from({length: built.length + 12}, () => Array(built[0].length + 12).fill(1));
    for (let y = 0; y < built.length; y++) for (let x = 0; x < built[0].length; x++) maze[y + 6][x + 6] = built[y][x];
    const { enemies, weaponPickups } = run(maze, stage, createEnemy, chooseEnemyType, isBossStage);
    assert.ok(enemies.length > 10 && enemies.length <= 64);
    assert.ok(enemies.some(enemy => enemy.type === 'emberling'), 'a chapel encounter must not depend on rare random placement');
    if (stage >= 2) assert.ok(enemies.some(enemy => enemy.type === 'wraith'));
    for (const enemy of enemies) {
      assert.ok(Math.hypot(enemy.x - 8.5, enemy.y - 8.5) > 8.5);
      assert.ok(weaponPickups.every(item => Math.hypot(enemy.x - item.x - .5, enemy.y - item.y - .5) > 2.6));
    }
  }
});
