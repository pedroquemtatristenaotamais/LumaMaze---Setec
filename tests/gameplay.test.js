import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeMaze, widenMaze } from '../maze-generator.js';
import * as config from '../config.js';
import { createEnemy, chooseEnemyType } from '../enemy-types.js';

const navigation = await import('../pathfinding.js').catch(() => ({}));
const combat = await import('../combat-difficulty.js').catch(() => ({}));
const { DIFFICULTIES } = config;

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

async function enemyScenario(grid, enemy, player, frames = 1, mode = 'normal', initialShots = 0) {
  const source = await readFile(new URL('../game.js', import.meta.url), 'utf8');
  const functions = ['walkableCell', 'blockedAt', 'moveEntity', 'hasLineOfSight', 'updateEnemies'];
  if (source.includes('  function findPathStep(')) functions.push('findPathStep');
  const run = new Function('maze', 'enemy', 'player', 'createDistanceField', 'frames', 'profiles', 'mode', 'initialShots', `
    const rows=maze.length, cols=maze[0].length, enemies=[enemy], secretDoors=[], hostileBullets=Array.from({length:initialShots},()=>({}));
    const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by), clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    const cellKey=(x,y)=>x+','+y, tone=()=>{}, stage=3, MAX_HOSTILE_BULLETS=128;
    const COMBAT_DIFFICULTIES=profiles,combatDifficulty=mode,randInt=max=>Math.floor(Math.random()*max);
    let damageCooldown=0, damage=0, navigationDirty=true, lastPathUpdate=-Infinity;
    const damagePlayer=amount=>{damage+=amount; damageCooldown=.72;};
    const navigation=createDistanceField(cols,rows,walkableCell);
    ${functions.map(name => functionSource(source, name)).join('\n')}
    for(let i=0;i<frames;i++) updateEnemies(.02,5000+i*20);
    return {enemy,hostileBullets,damage};
  `);
  return run(grid.map(row => [...row].map(Number)), enemy, player, navigation.createDistanceField, frames, config.COMBAT_DIFFICULTIES, mode, initialShots);
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
  const run = new Function('maze', 'stage', 'createEnemy', 'chooseEnemyType', 'isBossStage', 'getEnemyCount', `
    const cols=maze[0].length, rows=maze.length, player={x:8.5,y:8.5}, exit={x:cols-9,y:rows-9};
    const difficulty='normal',combatDifficulty='normal',secretRooms=[],MAX_ENEMIES=96;
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
    const { enemies, weaponPickups } = run(maze, stage, createEnemy, chooseEnemyType, isBossStage, combat.getEnemyCount);
    assert.ok(enemies.length > 10 && enemies.length <= 96);
    assert.ok(enemies.some(enemy => enemy.type === 'emberling'), 'a chapel encounter must not depend on rare random placement');
    if (stage >= 2) assert.ok(enemies.some(enemy => enemy.type === 'wraith'));
    for (const enemy of enemies) {
      assert.ok(Math.hypot(enemy.x - 8.5, enemy.y - 8.5) > 8.5);
      assert.ok(weaponPickups.every(item => Math.hypot(enemy.x - item.x - .5, enemy.y - item.y - .5) > 2.6));
    }
  }
});

test('player speed rises only ten percent, with no diagonal speed bonus', async () => {
  const { PLAYER_MOVE_SPEED } = await import('../config.js');
  assert.equal(PLAYER_MOVE_SPEED, 4.4);
  const source = await readFile(new URL('../game.js', import.meta.url), 'utf8');
  const run = new Function('keys', 'PLAYER_MOVE_SPEED', `
    const keyState=new Set(keys), player={x:4.5,y:4.5}, exit={x:99,y:99};
    const maze=Array.from({length:25},()=>Array(25).fill(0)), rows=25, cols=25;
    const secretDoors=[], coins=[], visitedAreas=new Set();
    const cellKey=(x,y)=>x+','+y, dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);
    const updateHUD=()=>{}, collectNearbyCoins=()=>{}, collectWeaponPickups=()=>{}, collectLootPickups=()=>{};
    let stepDistance=0, steps=0, lastPlayerCell='4,4', navigationDirty=false;
    ${['walkableCell','blockedAt','moveEntity','updatePlayer'].map(name=>functionSource(source,name)).join('\n')}
    for(let frame=0;frame<100;frame++)updatePlayer(.01);
    return Math.hypot(player.x-4.5,player.y-4.5);
  `);
  for (const keys of [['d'], ['d','s']]) assert.ok(Math.abs(run(keys, PLAYER_MOVE_SPEED) - 4.4) < 1e-9);
});

test('camera changes preserve the three map sizes and stage growth', () => {
  assert.deepEqual(Object.entries(DIFFICULTIES).map(([id, size])=>[id,size.cols,size.rows]), [
    ['easy',29,21], ['normal',39,29], ['hard',49,37]
  ]);
  for(const [id, expected] of [['easy',[126,82]],['normal',[146,98]],['hard',[166,114]]]) {
    const size=DIFFICULTIES[id], wide=widenMaze(makeMaze(size.cols+28,size.rows+14,8,77));
    assert.deepEqual([wide[0].length+12,wide.length+12],expected);
  }
});

test('combat difficulty resolves independently of map size, including old checkpoints', () => {
  assert.equal(typeof combat.resolveCombatDifficulty, 'function');
  assert.equal(combat.resolveCombatDifficulty(null, 'hard', false), 'hard');
  assert.equal(combat.resolveCombatDifficulty({ difficulty: 'hard', combatDifficulty: 'easy' }, 'normal', true), 'easy');
  assert.equal(combat.resolveCombatDifficulty({ difficulty: 'easy' }, 'hard', true), 'normal');
  assert.equal(combat.resolveCombatDifficulty({ combatDifficulty: 'invalid' }, 'hard', true), 'normal');
  assert.equal(combat.resolveCombatDifficulty(null, 'invalid', false), 'normal');
});

test('combat profiles increase enemy pressure without changing the map dimensions or player speed', () => {
  assert.equal(typeof combat.getEnemyCount, 'function');
  assert.ok(config.COMBAT_DIFFICULTIES);
  assert.equal(config.PLAYER_MOVE_SPEED, 4.4);
  const medium = combat.getEnemyCount(90, 70, 1, 'normal');
  const large = combat.getEnemyCount(110, 86, 1, 'normal');
  assert.ok(medium >= 36 && medium <= 45);
  assert.ok(large >= 50 && large <= 65);
  assert.ok(combat.getEnemyCount(90, 70, 1, 'easy') < medium);
  assert.ok(combat.getEnemyCount(90, 70, 1, 'hard') > medium);
  assert.ok(combat.getEnemyCount(90, 70, 5, 'normal') > medium);
  assert.equal(combat.getEnemyCount(166, 114, 8, 'hard'), 96);
  for (const type of ['skeleton', 'warrior', 'runner', 'wraith', 'archer', 'emberling']) {
    const easy = createEnemy(type, 1, 1, 3, () => .5, 'easy');
    const normal = createEnemy(type, 1, 1, 3, () => .5, 'normal');
    const hard = createEnemy(type, 1, 1, 3, () => .5, 'hard');
    assert.ok(easy.speed < normal.speed && normal.speed < hard.speed);
    assert.ok(easy.damage < normal.damage && normal.damage < hard.damage);
    assert.ok(easy.shotCooldown > normal.shotCooldown && normal.shotCooldown > hard.shotCooldown);
    assert.ok(easy.meleeCooldown > normal.meleeCooldown && normal.meleeCooldown > hard.meleeCooldown);
    assert.ok(easy.projectileWindup >= .3 && hard.projectileWindup >= .3);
  }
});

test('every regular enemy class visibly winds up a projectile attack in open sight', async () => {
  for (const type of ['skeleton', 'warrior', 'runner', 'wraith', 'archer', 'emberling']) {
    const enemy = createEnemy(type, 1.5, 1.5, 3, () => .5);
    enemy.attackAt = 5000;
    const before = await enemyScenario(['1111111111', '1000000001', '1111111111'], structuredClone(enemy), { x: 7.5, y: 1.5 });
    assert.ok(before.enemy.attackAnim >= .3, `${type} must visibly telegraph a shot`);
    assert.equal(before.hostileBullets.length, 0);
    const after = await enemyScenario(['1111111111', '1000000001', '1111111111'], enemy, { x: 7.5, y: 1.5 }, 45);
    assert.ok(after.hostileBullets.length >= 1 && after.hostileBullets.length <= 3, `${type} must release a bounded projectile pattern`);
    const blocked = await enemyScenario(['1111111111', '1000100001', '1111111111'], createEnemy(type, 1.5, 1.5, 3, () => .5), { x: 7.5, y: 1.5 }, 45);
    assert.equal(blocked.hostileBullets.length, 0, `${type} cannot fire through a wall`);
  }
});

test('returning to the main menu stops combat, preserves checkpoint and selections, and restores title focus', async () => {
  const source = await readFile(new URL('../game.js', import.meta.url), 'utf8');
  const run = new Function(`
    let running=true,paused=true,settingsOpen=true,pausedBeforeSettings=true,won=false,dead=false;
    let mouseHeld=true,lastMouse={active:true},fireCooldown=20,reloadTimer=1,damageCooldown=.5,hitFlash=.2;
    let bullets=[{}],hostileBullets=[{}],particles=[{}],floatingTexts=[{}],combatPulse=1,showMap=true;
    let lastIdleDraw=0,checkpoint={stage:3,difficulty:'hard',combatDifficulty:'easy'};
    const keyState=new Set(['f','w']),player={moving:true},difficulty='hard',combatDifficulty='easy';
    const difficultySelect={value:'hard'},combatDifficultySelect={value:'easy'};
    const classes=()=>({values:new Set(),add(value){this.values.add(value);},remove(value){this.values.delete(value);},contains(value){return this.values.has(value);}});
    const overlay=()=>({classList:classes(),inert:false,setAttribute(){},removeAttribute(){}});
    const startOverlay=overlay(),pauseOverlay=overlay(),winOverlay=overlay(),deadOverlay=overlay(),settingsOverlay=overlay();
    const titleScreen=overlay(),canvasWrap=overlay(),appShell={inert:false},pauseButton={disabled:false,textContent:''},gameStatus={textContent:''};
    titleScreen.classList.add('is-hidden');titleScreen.inert=true;canvasWrap.classList.add('playing');
    let focused='canvas',threat=1;
    const titleStartButton={focus(){focused='titleStartButton';}},titleContinueButton=overlay();
    const audioPlayer={setThreat(value){threat=value;}},requestAnimationFrame=callback=>callback();
    const loadCampaignSave=()=>checkpoint,clearCampaignSave=()=>{checkpoint=null;},saveCampaign=value=>{checkpoint=value;};
    ${['showOverlay','hideOverlay','returnToMenu'].map(name => functionSource(source, name)).join('\n')}
    returnToMenu();
    return {running,paused,settingsOpen,pausedBeforeSettings,mouseHeld,reloadTimer,fireCooldown,bullets,hostileBullets,keys:[...keyState],checkpoint,focused,threat,
      size:difficultySelect.value,combat:combatDifficultySelect.value,playing:canvasWrap.classList.contains('playing'),titleHidden:titleScreen.classList.contains('is-hidden'),titleInert:titleScreen.inert,appInert:appShell.inert,startHidden:startOverlay.classList.contains('hidden')};
  `);
  const result = run();
  assert.equal(result.running, false); assert.equal(result.paused, false); assert.equal(result.settingsOpen, false);
  assert.equal(result.mouseHeld, false); assert.equal(result.reloadTimer, 0); assert.equal(result.fireCooldown, 0);
  assert.deepEqual(result.bullets, []); assert.deepEqual(result.hostileBullets, []); assert.deepEqual(result.keys, []);
  assert.deepEqual(result.checkpoint, {stage:3,difficulty:'hard',combatDifficulty:'easy'});
  assert.equal(result.size, 'hard'); assert.equal(result.combat, 'easy');
  assert.equal(result.playing, false); assert.equal(result.titleHidden, false); assert.equal(result.titleInert, false); assert.equal(result.appInert, true);
  assert.equal(result.startHidden, false); assert.equal(result.focused, 'titleStartButton'); assert.equal(result.threat, 0);
});

test('projectile collision finds nearby targets across bucket edges and skips dead or distant enemies', async () => {
  const source = await readFile(new URL('../game.js', import.meta.url), 'utf8');
  const run = new Function(`
    const cols=100,rows=100,MAX_ENEMIES=96;
    const enemies=Array.from({length:94},(_,i)=>({x:50+i%10,y:50+Math.floor(i/10),alive:true,boss:false}));
    enemies.push({x:4.1,y:3.5,alive:false,boss:false},{x:4.1,y:3.5,alive:true,boss:true});
    let enemyBucketHeads=null,enemyBucketNext=null,enemyBucketCols=0,enemyBucketRows=0;
    ${['rebuildEnemyBuckets','enemyAtBullet'].map(name=>functionSource(source,name)).join('\n')}
    rebuildEnemyBuckets();
    const acrossEdge=enemyAtBullet(3.7,3.5),miss=enemyAtBullet(3.5,3.5);
    enemies[95].alive=false;
    return {index:enemies.indexOf(acrossEdge),miss,afterDeath:enemyAtBullet(3.7,3.5)};
  `);
  const result = run();
  assert.equal(result.index, 95); assert.equal(result.miss, null); assert.equal(result.afterDeath, null);
});

test('projectile pressure remains capped and distant enemies stay asleep', async () => {
  const emberling=createEnemy('emberling',1.5,1.5,3,()=>.5,'hard');
  emberling.attackMode='shoot';emberling.attackAnim=.01;emberling.attackAim=0;emberling.shotAt=5000;
  const capped=await enemyScenario(['1111111111','1000000001','1111111111'],emberling,{x:7.5,y:1.5},1,'hard',127);
  assert.equal(capped.hostileBullets.length,128);
  const far=createEnemy('skeleton',1.5,1.5,3,()=>.5);
  const distant=await enemyScenario(['1'.repeat(42),'1'+'0'.repeat(40)+'1','1'.repeat(42)],far,{x:38.5,y:1.5},100);
  assert.equal(distant.enemy.x,1.5);assert.equal(distant.enemy.attackAnim,0);assert.equal(distant.hostileBullets.length,0);
});
