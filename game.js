import { DIFFICULTIES, COMBAT_DIFFICULTIES, MAX_STAGES, PLAYER_MOVE_SPEED, WEAPONS } from './config.js';
import { makeMaze, widenMaze } from './maze-generator.js';
import { createAudioPlayer } from './audio.js';
import { createRenderer } from './renderer.js';
import { createTitleScene } from './title-scene.js';
import { createHUD } from './hud.js';
import { isBossStage, createEnemy, chooseEnemyType } from './enemy-types.js';
import { createDistanceField } from './pathfinding.js';
import { getEnemyCount, resolveCombatDifficulty } from './combat-difficulty.js';
import { loadCampaignSave, saveCampaign, clearCampaignSave, loadSettings, saveSettings } from './save-system.js';

(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('mazeCanvas');
  const canvasWrap = $('canvasWrap');
  const titleScreen = $('titleScreen');
  const titleStartButton = $('titleStartButton');
  const titleContinueButton = $('titleContinueButton');
  const settingsOverlay = $('settingsOverlay');
  const volumeSetting = $('volumeSetting');
  const soundSetting = $('soundSetting');
  const brightnessSetting = $('brightnessSetting');
  const motionSetting = $('motionSetting');
  const graphicsQualitySetting = $('graphicsQualitySetting');
  const fpsSetting = $('fpsSetting');
  const performanceReadout = $('performanceReadout');
  const appShell = document.querySelector('.app-shell');
  const closeSettingsButton = $('closeSettingsButton');
  const startOverlay = $('startOverlay');
  const pauseOverlay = $('pauseOverlay');
  const winOverlay = $('winOverlay');
  const deadOverlay = $('deadOverlay');
  const startButton = $('startButton');
  const resumeButton = $('resumeButton');
  const pauseMenuButton = $('pauseMenuButton');
  const nextButton = $('nextButton');
  const retryButton = $('retryButton');
  const restartButton = $('restartButton');
  const pauseButton = $('pauseButton');
  const soundButton = $('soundButton');
  const difficultySelect = $('difficultySelect');
  const combatDifficultySelect = $('combatDifficultySelect');
  const gameStatus = $('gameStatus');
  const levelLabel = $('levelLabel');
  const timerValue = $('timerValue');
  const timerBar = $('timerBar');
  const coinCount = $('coinCount');
  const stepCount = $('stepCount');
  const finalTime = $('finalTime');
  const finalCoins = $('finalCoins');
  const stageCounter = $('stageCounter');
  const healthValue = $('healthValue');
  const healthBar = $('healthBar');
  const killCount = $('killCount');
  const enemyCount = $('enemyCount');
  const weaponName = $('weaponName');
  const ammoCount = $('ammoCount');
  const weaponButtons = [...document.querySelectorAll('[data-weapon]')];
  const hudWeaponButtons = [...document.querySelectorAll('[data-hud-weapon]')];
  const winHeadline = $('winHeadline');
  const winCopy = $('winCopy');


  let maze = [];
  let cols = 29;
  let rows = 21;
  let difficulty = 'normal';
  let combatDifficulty = 'normal';
  let stage = 1;
  let player = { x: 1.5, y: 1.5, angle: 0, moving: false };
  let exit = { x: 27, y: 19 };
  let coins = [];
  let weaponPickups = [];
  let lootPickups = [];
  let secretDoors = [];
  let secretRooms = [];
  let hostileBullets = [];
  let hasKey = false;
  let objectiveText = 'Encontre a chave antiga';
  let showMap = false;
  let settingsOpen = false;
  let pausedBeforeSettings = false;
  let brightness = 0.5;
  let reducedMotion = false;
  let settings = loadSettings();
  let graphicsQuality = ['auto', 'high', 'low'].includes(settings.graphicsQuality) ? settings.graphicsQuality : 'auto';
  let showFps = !!settings.showFps;
  let lastIdleDraw = -Infinity;
  let fpsWindowStart = 0;
  let fpsFrames = 0;
  let lastExitWarnAt = 0;
  let lastThreatCheck = 0;
  let weaponInventory = new Set();
  let pickupToast = '';
  let pickupToastUntil = 0;
  let wallBounceCooldown = 0;
  let enemies = [];
  let bullets = [];
  let particles = [];
  let floatingTexts = [];
  let combatPulse = 0;
  let visitedAreas = new Set();
  let collected = 0;
  let steps = 0;
  let stepDistance = 0;
  let kills = 0;
  let health = 100;
  let elapsed = 0;
  let startTime = 0;
  let lastFrame = 0;
  let running = false;
  let paused = false;
  let won = false;
  let dead = false;
  let soundOn = true;
  let fireCooldown = 0;
  let reloadTimer = 0;
  let damageCooldown = 0;
  let hitFlash = 0;
  let mouseHeld = false;
  let lastMouse = null;
  let currentWeapon = null;
  let stageCoins = 0;
  let ammo = {};
  let navigation = null;
  let navigationDirty = true;
  let lastPathUpdate = -Infinity;
  let lastPlayerCell = '1,1';
  let enemyBucketHeads = null;
  let enemyBucketNext = null;
  let enemyBucketCols = 0;
  let enemyBucketRows = 0;
  const hudValues = {};
  const MAX_ENEMIES = 96;
  const MAX_BULLETS = 96;
  const MAX_HOSTILE_BULLETS = 128;
  const MAX_PARTICLES = 320;
  const keyState = new Set();

  soundOn = settings.sound !== false;
  brightness = Math.max(0, Math.min(1, Number(settings.brightness ?? 0.5)));
  reducedMotion = !!settings.reducedMotion;
  const audioPlayer = createAudioPlayer(() => soundOn);
  audioPlayer.setVolume(settings.volume ?? 0.65);
  if (volumeSetting) volumeSetting.value = String(settings.volume ?? 0.65);
  if (soundSetting) soundSetting.checked = soundOn;
  if (brightnessSetting) brightnessSetting.value = String(brightness);
  if (motionSetting) motionSetting.checked = reducedMotion;
  if (graphicsQualitySetting) graphicsQualitySetting.value = graphicsQuality;
  if (fpsSetting) fpsSetting.checked = showFps;
  const persistSettings = () => saveSettings({ sound: soundOn, volume: Number(volumeSetting?.value ?? 0.65), brightness, reducedMotion, graphicsQuality, showFps });
  if (soundButton) { soundButton.classList.toggle('sound-muted', !soundOn); soundButton.textContent = soundOn ? '♫' : '♪̸'; }
  const tone = audioPlayer.tone;
  const hud = createHUD(document);
  const renderer = createRenderer({
    canvas, canvasWrap,
    getState: () => ({ maze, cols, rows, player, exit, coins, weaponPickups, lootPickups, secretDoors, enemies, bullets, hostileBullets, particles, floatingTexts, combatPulse, pickupToast, pickupToastUntil, hitFlash, hasKey, objectiveText, showMap, brightness, reducedMotion, graphicsQuality })
  });
  const titleScene = createTitleScene({ canvas: $('titleFxCanvas'), screen: titleScreen, getReducedMotion: () => reducedMotion });
  const selectionScene = createTitleScene({ canvas: $('startFxCanvas'), screen: startOverlay, variant: 'selection', getReducedMotion: () => reducedMotion });
  let selectionSceneActive = false;
  selectionScene.setActive?.(false);

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const randInt = max => Math.floor(Math.random() * max);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const cellKey = (x, y) => `${x},${y}`;

  function openCells() {
    const result = [];
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (maze[y][x] === 1) continue;
        // Hidden annexes are intentionally excluded from normal spawning and loot placement
        // until the player opens their stone panel with E.
        const concealed = secretRooms.some(room => !room.opened &&
          ((room.x === x && room.y === y) || room.cells.some(cell => cell.x === x && cell.y === y)));
        if (!concealed) result.push({ x, y });
      }
    }
    return result;
  }

  function createSecretRooms() {
    const candidates = [];
    const directions = [[1,0],[-1,0],[0,1],[0,-1]];
    for (let y = 4; y < rows - 4; y++) for (let x = 4; x < cols - 4; x++) {
      if (maze[y][x] !== 1) continue;
      const openSides = directions.filter(([dx,dy]) => maze[y + dy]?.[x + dx] !== undefined && maze[y + dy][x + dx] !== 1);
      if (openSides.length !== 1) continue;
      const [corridorDx, corridorDy] = openSides[0];
      const roomDx = -corridorDx, roomDy = -corridorDy;
      const sideDx = roomDy, sideDy = -roomDx;
      const cells = [];
      let valid = true;
      for (let depth = 1; depth <= 4 && valid; depth++) for (let side = -2; side <= 2; side++) {
        const rx = x + roomDx * depth + sideDx * side;
        const ry = y + roomDy * depth + sideDy * side;
        if (rx < 2 || ry < 2 || rx >= cols - 2 || ry >= rows - 2 || maze[ry][rx] !== 1) { valid = false; break; }
        cells.push({ x: rx, y: ry });
      }
      if (!valid) continue;
      const center = { x: x + roomDx * 2.5, y: y + roomDy * 2.5 };
      if (dist(center.x, center.y, player.x, player.y) < 7.5 || dist(center.x, center.y, exit.x + .5, exit.y + .5) < 5) continue;
      candidates.push({ x, y, cells, center, corridorDx, corridorDy });
    }
    candidates.sort((a,b) => dist(b.center.x,b.center.y,player.x,player.y) - dist(a.center.x,a.center.y,player.x,player.y) + (Math.random() - .5) * 2.4);
    const wanted = stage >= 5 ? 2 : 1;
    const result = [];
    for (const candidate of candidates) {
      if (result.length >= wanted) break;
      if (result.some(room => dist(room.center.x, room.center.y, candidate.center.x, candidate.center.y) < 11)) continue;
      // Each hidden annex is carved behind a single sealed stone panel.
      for (const cell of candidate.cells) maze[cell.y][cell.x] = 0;
      maze[candidate.y][candidate.x] = 0;
      result.push({ ...candidate, id: result.length + 1, opened: false, revealed: false });
    }
    return result;
  }

  function hasSecretDoorAt(x, y) {
    return secretDoors.some(door => !door.opened && door.x === x && door.y === y);
  }

  function placeLootPickups() {
    const cells = openCells().filter(p => !secretRooms.some(room => room.cells.some(cell => cell.x === p.x && cell.y === p.y)) && dist(p.x + .5, p.y + .5, player.x, player.y) > 5 &&
      dist(p.x + .5, p.y + .5, exit.x + .5, exit.y + .5) > 2.8 &&
      weaponPickups.every(w => dist(p.x + .5, p.y + .5, w.x + .5, w.y + .5) > 1.8) &&
      enemies.every(e => dist(p.x + .5, p.y + .5, e.x, e.y) > 1.8));
    const chosen = [];
    const add = (type, count = 1) => {
      for (let i = 0; i < count && cells.length; i++) {
        const possible = cells.filter(cell => chosen.every(item => dist(cell.x, cell.y, item.x, item.y) > 2.2));
        if (!possible.length) break;
        const cell = possible[randInt(possible.length)];
        chosen.push({ type, x: cell.x, y: cell.y, phase: Math.random() * Math.PI * 2, taken: false });
        cells.splice(cells.indexOf(cell), 1);
      }
    };
    add('health', Math.min(2, 1 + Math.floor(stage / 4)));
    add('ammo', Math.min(3, 1 + Math.floor(stage / 3)));
    if (!isBossStage(stage) && cells.length) {
      const keyPool = cells.filter(p => dist(p.x + .5, p.y + .5, exit.x + .5, exit.y + .5) > 4 &&
        dist(p.x + .5, p.y + .5, player.x, player.y) > 9);
      const fallback = cells.filter(p => dist(p.x + .5, p.y + .5, player.x, player.y) > 7 && dist(p.x + .5, p.y + .5, exit.x + .5, exit.y + .5) > 2.5);
      const source = keyPool.length ? keyPool : fallback;
      const guaranteedKeyPool = source.length ? source : cells.filter(p =>
      dist(p.x + .5, p.y + .5, player.x, player.y) > 3 &&
      dist(p.x + .5, p.y + .5, exit.x + .5, exit.y + .5) > 1.5);
      if (guaranteedKeyPool.length) {
        const p = guaranteedKeyPool[randInt(guaranteedKeyPool.length)];
        chosen.push({ type: 'key', x: p.x, y: p.y, phase: Math.random() * Math.PI * 2, taken: false });
      }
    }
    for (const room of secretRooms) {
      const p = room.cells[Math.floor(room.cells.length * .55)];
      if (p) chosen.push({ type: 'cache', x: p.x, y: p.y, phase: Math.random() * Math.PI * 2, taken: false, secret: true, secretId: room.id });
      const q = room.cells[Math.floor(room.cells.length * .78)];
      if (q) chosen.push({ type: Math.random() < .5 ? 'health' : 'ammo', x: q.x, y: q.y, phase: Math.random() * Math.PI * 2, taken: false, secret: true, secretId: room.id });
    }
    return chosen;
  }

  function tryInteract() {
    if (!running || paused || settingsOpen || won || dead) return;
    const door = secretDoors.find(item => !item.opened && dist(player.x, player.y, item.x + .5, item.y + .5) < .95);
    if (door) {
      door.revealed = true;
      door.opened = true;
      navigationDirty = true;
      lastPathUpdate = -Infinity;
      objectiveText = hasKey ? 'Encontre a saída' : objectiveText;
      showPickupToast('PASSAGEM SECRETA ABERTA · TESOURO ESCONDIDO');
      showFloatingText(door.x + .5, door.y + .5, 'PASSAGEM REVELADA', '#e7cf91', 1.6);
      tone(180, .2, 'triangle', .04); tone(310, .12, 'sine', .025);
      return;
    }
    const cache = lootPickups.find(item => item.type === 'cache' && !item.taken && dist(player.x, player.y, item.x + .5, item.y + .5) < .95);
    if (cache) { cache.taken = true; health = Math.min(100, health + 20); if (currentWeapon && ammo[currentWeapon]) ammo[currentWeapon].reserve += currentWeapon === 'shotgun' ? 8 : currentWeapon === 'ak' ? 30 : 12; showPickupToast('BAÚ ANTIGO · VIDA E MUNIÇÃO'); showFloatingText(cache.x + .5, cache.y + .5, 'TESOURO ENCONTRADO', '#f2d686', 1.5); updateHUD(); updateWeaponUI(); tone(520,.16,'triangle',.035); }
    else showPickupToast('NADA AO ALCANCE · PROCURE PAREDES COM RACHADURAS', 1200);
  }

  function placeCoins(count) {
    const cells = openCells().filter(p =>
      dist(p.x + .5, p.y + .5, player.x, player.y) > 4.5 &&
      dist(p.x + .5, p.y + .5, exit.x + .5, exit.y + .5) > 3.5
    );
    const chosen = [];
    while (chosen.length < Math.min(count, cells.length) && cells.length) {
      const p = cells.splice(randInt(cells.length), 1)[0];
      chosen.push({ ...p, phase: Math.random() * Math.PI * 2, taken: false });
    }
    return chosen;
  }

  function placeWeaponPickups() {
    const cells = openCells().map(p => ({ ...p, wx: p.x + .5, wy: p.y + .5 }))
      .filter(p => dist(p.wx, p.wy, player.x, player.y) > 4.5 &&
        dist(p.wx, p.wy, exit.x + .5, exit.y + .5) > 4.0);
    const plans = [
      { id: 'pistol', target: 8.5 },
      { id: 'shotgun', target: 18 },
      { id: 'ak', target: 29 }
    ];
    const chosen = [];
    for (const plan of plans) {
      const available = cells.filter(p => chosen.every(c => dist(c.x + .5, c.y + .5, p.wx, p.wy) > 4.5));
      if (!available.length) continue;
      available.sort((a, b) => Math.abs(dist(a.wx, a.wy, player.x, player.y) - plan.target) -
        Math.abs(dist(b.wx, b.wy, player.x, player.y) - plan.target));
      const shortlist = available.slice(0, Math.min(12, available.length));
      const p = shortlist[randInt(shortlist.length)];
      chosen.push({ ...p, id: plan.id, phase: Math.random() * Math.PI * 2, taken: false });
    }
    return chosen;
  }

  function collectLootPickups() {
    for (const item of lootPickups) {
      if (item.type === 'cache' || item.taken || dist(player.x, player.y, item.x + .5, item.y + .5) > .48) continue;
      item.taken = true;
      if (item.type === 'key') {
        hasKey = true; objectiveText = 'Chave obtida · encontre a saída';
        showPickupToast('CHAVE ANTIGA ENCONTRADA · SAÍDA DESTRANCADA');
        showFloatingText(item.x + .5, item.y + .5, 'SAÍDA DESTRANCADA', '#f6d578', 1.7);
        tone(640,.12,'triangle',.04); setTimeout(() => tone(850,.16,'sine',.03),70);
      } else if (item.type === 'health') {
        const before = health; health = Math.min(100, health + 32);
        showFloatingText(item.x + .5, item.y + .5, health > before ? `+${health - before} VIDA` : 'VIDA COMPLETA', '#ffd58a');
        showPickupToast(health > before ? `KIT MÉDICO · +${health-before} DE VIDA` : 'KIT MÉDICO · VIDA JÁ COMPLETA');
        tone(500,.1,'sine',.035);
      } else if (item.type === 'ammo') {
        const owned = [...weaponInventory];
        const target = owned.length ? owned[randInt(owned.length)] : ['pistol','shotgun','ak'][randInt(3)];
        const weapon = WEAPONS[target];
        ammo[target] ||= { mag: 0, reserve: 0 };
        const amount = target === 'shotgun' ? 8 : target === 'ak' ? 32 : 16;
        ammo[target].reserve += amount;
        showFloatingText(item.x + .5, item.y + .5, `+${amount} MUNIÇÃO`, '#e7c995');
        showPickupToast(`MUNIÇÃO ${weapon.name} +${amount}`);
        tone(690,.065,'triangle',.025);
      } else if (item.type === 'cache') {
        const before = health; health = Math.min(100, health + 24);
        for (const id of weaponInventory) if (ammo[id]) ammo[id].reserve += id === 'shotgun' ? 8 : id === 'ak' ? 30 : 12;
        showPickupToast('TESOURO SECRETO · VIDA E MUNIÇÃO');
        tone(520,.15,'triangle',.035); setTimeout(() => tone(760,.18,'sine',.03),80);
      }
      updateHUD(); updateWeaponUI();
    }
  }

  function damagePlayer(amount, source = 'enemy') {
    if (damageCooldown > 0 || dead) return false;
    health = Math.max(0, health - amount);
    damageCooldown = .72; hitFlash = .28;
    tone(source === 'projectile' ? 105 : 72, .14, 'sawtooth', .045);
    updateHUD();
    if (health <= 0) gameOver();
    return true;
  }

  function dropEnemyLoot(enemy) {
    if (enemy.dropKey) {
      objectiveText = 'Guardião derrotado · pegue a chave caída';
      lootPickups.push({ type: 'key', x: Math.floor(enemy.x), y: Math.floor(enemy.y), phase: Math.random()*6, taken: false });
      showPickupToast('GUARDIÃO DERROTADO · A CHAVE CAIU');
      lootPickups.push({ type: 'health', x: Math.floor(enemy.x), y: Math.floor(enemy.y), phase: Math.random()*6, taken: false });
    } else {
      const roll = Math.random();
      if (roll < .17) lootPickups.push({ type: 'health', x: Math.floor(enemy.x), y: Math.floor(enemy.y), phase: Math.random()*6, taken: false });
      else if (roll < .49) lootPickups.push({ type: 'ammo', x: Math.floor(enemy.x), y: Math.floor(enemy.y), phase: Math.random()*6, taken: false });
    }
  }

  function showPickupToast(message, duration = 2100) {
    pickupToast = message;
    pickupToastUntil = performance.now() + duration;
  }

  function showFloatingText(x, y, text, color = '#f4d59a', life = 1.0) {
    if (floatingTexts.length >= 24) floatingTexts.shift();
    floatingTexts.push({ x, y, text, color, life, maxLife: life });
  }

  function collectWeaponPickups() {
    for (const pickup of weaponPickups) {
      if (pickup.taken || dist(player.x, player.y, pickup.x + .5, pickup.y + .5) > .62) continue;
      pickup.taken = true;
      const weapon = WEAPONS[pickup.id];
      if (!weaponInventory.has(pickup.id)) {
        weaponInventory.add(pickup.id);
        const stored = ammo[pickup.id] || { mag: 0, reserve: 0 };
        ammo[pickup.id] = { mag: stored.mag > 0 ? stored.mag : weapon.magazine, reserve: stored.reserve > 0 ? stored.reserve + Math.floor(weapon.reserve * .55) : weapon.reserve };
        currentWeapon = pickup.id;
        if (reloadTimer > 0) { reloadTimer = 0; gameStatus.textContent = 'ARMA EQUIPADA'; }
        showFloatingText(pickup.x + .5, pickup.y + .5, weapon.name, '#ffd78b', 1.4);
        showPickupToast(`${weapon.name} ENCONTRADA  ·  TECLA ${pickup.id === 'pistol' ? '1' : pickup.id === 'shotgun' ? '2' : '3'}`);
        tone(weapon.sound === 'shotgun' ? 300 : weapon.sound === 'ak' ? 210 : 520, .14, 'triangle', .04);
        updateWeaponUI();
      } else {
        ammo[pickup.id].reserve += pickup.id === 'shotgun' ? 12 : pickup.id === 'ak' ? 40 : 24;
        showPickupToast(`MUNIÇÃO ${weapon.name.toLowerCase()} RECOLHIDA`);
        tone(640, .08, 'sine', .025);
        updateWeaponUI();
      }
    }
  }

  function spawnEnemies() {
    const pool = openCells().filter(p => dist(p.x + .5, p.y + .5, player.x, player.y) > 8.5 &&
      dist(p.x + .5, p.y + .5, exit.x + .5, exit.y + .5) > 4.2 &&
      weaponPickups.every(w => dist(p.x + .5, p.y + .5, w.x + .5, w.y + .5) > 2.6));
    const amount = Math.min(getEnemyCount(cols, rows, stage, combatDifficulty), MAX_ENEMIES) - (isBossStage(stage) ? 1 : 0);
    enemies = [];
    const placed = [];
    const regionalPlans = [{ region: 3, type: 'emberling' }];
    if (stage >= 2) regionalPlans.push({ region: 2, type: 'wraith' });
    if (stage >= 3) regionalPlans.push({ region: 4, type: 'emberling' });
    for (let i = 0; i < amount && pool.length; i++) {
      let bestIndex = randInt(pool.length), bestScore = -Infinity;
      const encounter = regionalPlans[i];
      const regionalCells = encounter ? pool.reduce((indices, p, index) => {
        if (maze[p.y][p.x] === encounter.region) indices.push(index);
        return indices;
      }, []) : [];
      if (regionalCells.length) bestIndex = regionalCells[randInt(regionalCells.length)];
      const samples = regionalCells.length ? 0 : Math.min(36, pool.length);
      for (let sample = 0; sample < samples; sample++) {
        const index = randInt(pool.length), candidate = pool[index];
        const nearest = placed.length ? Math.min(...placed.map(q => dist(candidate.x, candidate.y, q.x, q.y))) : 6;
        const score = nearest + Math.random() * 2.2;
        if (score > bestScore) { bestScore = score; bestIndex = index; }
      }
      const p = pool.splice(bestIndex, 1)[0];
      placed.push(p);
      for (let j = pool.length - 1; j >= 0; j--) if (dist(pool[j].x, pool[j].y, p.x, p.y) < 1.25) pool.splice(j, 1);
      const type = regionalCells.length ? encounter.type : chooseEnemyType(stage, Math.random, maze[p.y][p.x]);
      enemies.push(createEnemy(type, p.x + .5, p.y + .5, stage, Math.random, combatDifficulty));
    }

    // A named guardian waits near the exit on milestone stages and carries the key.
    if (isBossStage(stage)) {
      const bossCandidates = openCells().filter(p => {
        const fromPlayer = dist(p.x + .5, p.y + .5, player.x, player.y);
        const fromExit = dist(p.x + .5, p.y + .5, exit.x + .5, exit.y + .5);
        return fromPlayer > 10 && fromExit > 2.7 && fromExit < 9 && weaponPickups.every(w => dist(p.x + .5, p.y + .5, w.x + .5, w.y + .5) > 2.6) &&
          enemies.every(e => dist(e.x, e.y, p.x + .5, p.y + .5) > 2.3);
      });
      bossCandidates.sort((a,b) => dist(a.x+.5,a.y+.5,exit.x+.5,exit.y+.5) - dist(b.x+.5,b.y+.5,exit.x+.5,exit.y+.5));
      const p = bossCandidates[0];
      const fallback = p || openCells().filter(cell => dist(cell.x+.5,cell.y+.5,player.x,player.y)>10 && weaponPickups.every(w => dist(cell.x+.5,cell.y+.5,w.x+.5,w.y+.5)>2.6) && enemies.every(e => dist(e.x,e.y,cell.x+.5,cell.y+.5)>2)).sort((a,b)=>dist(b.x,b.y,player.x,player.y)-dist(a.x,a.y,player.x,player.y))[0];
      if (fallback) { const boss = createEnemy('guardian', fallback.x + .5, fallback.y + .5, stage, Math.random, combatDifficulty); boss.dropKey = true; enemies.push(boss); }
    }
  }

  function newGame(resetCampaign = true, continueSaved = false) {
    const saved = continueSaved ? loadCampaignSave() : null;
    difficulty = saved && saved.difficulty in DIFFICULTIES
      ? saved.difficulty
      : (difficultySelect.value in DIFFICULTIES ? difficultySelect.value : 'normal');
    difficultySelect.value = difficulty;
    combatDifficulty = resolveCombatDifficulty(saved, combatDifficultySelect?.value, continueSaved);
    if (combatDifficultySelect) combatDifficultySelect.value = combatDifficulty;
    if (resetCampaign && !continueSaved) { stage = 1; clearCampaignSave(); titleContinueButton?.classList.add('hidden'); }
    else if (saved) stage = saved.stage;
    collected = 0; steps = 0; stepDistance = 0; kills = saved?.kills || 0; health = saved?.health ?? 100;
    weaponInventory = new Set(saved?.inventory && Array.isArray(saved.inventory) ? saved.inventory : []);
    ammo = saved?.ammo && typeof saved.ammo === 'object' ? structuredClone(saved.ammo) : {};
    currentWeapon = saved?.currentWeapon && weaponInventory.has(saved.currentWeapon) ? saved.currentWeapon : null;
    elapsed = saved?.elapsed || 0;
    canvasWrap.classList.add('playing');
    if (!saved) elapsed = 0; running = true; paused = false; won = false; dead = false;
    showMap = false; settingsOpen = false; hasKey = false;
    startTime = performance.now() - elapsed; fireCooldown = 0; reloadTimer = 0; damageCooldown = 0; hitFlash = 0;
    if (!saved) { currentWeapon = null; weaponInventory = new Set(); ammo = {}; }
    pickupToast = ''; pickupToastUntil = 0; wallBounceCooldown = 0;
    bullets = []; hostileBullets = []; particles = []; keyState.clear(); mouseHeld = false;
    createLevel();
    hideOverlay(startOverlay); hideOverlay(pauseOverlay); hideOverlay(winOverlay); hideOverlay(deadOverlay);
    canvas.tabIndex = 0; canvas.focus({ preventScroll: true });
    pauseButton.disabled = false; pauseButton.textContent = 'Ⅱ';
    gameStatus.textContent = DIFFICULTIES[difficulty].status;
    tone(175, .09, 'triangle', .025);
  }

  function createLevel() {
    const base = DIFFICULTIES[difficulty];
    let sourceCols = base.cols + (stage - 1) * 4;
    let sourceRows = base.rows + (stage - 1) * 2;
    if (sourceCols % 2 === 0) sourceCols++;
    if (sourceRows % 2 === 0) sourceRows++;
    const builtMaze = widenMaze(makeMaze(sourceCols, sourceRows, stage));
    const padding = 6; // Safe stone margin lets secret annexes be carved outside the normal boundary.
    maze = Array.from({ length: builtMaze.length + padding * 2 }, () => Array(builtMaze[0].length + padding * 2).fill(1));
    for (let y = 0; y < builtMaze.length; y++) for (let x = 0; x < builtMaze[0].length; x++) maze[y + padding][x + padding] = builtMaze[y][x];
    rows = maze.length; cols = maze[0].length;
    exit = { x: cols - padding - 3, y: rows - padding - 3 };
    maze[exit.y][exit.x] = 0;
    player = { x: padding + 2.5, y: padding + 2.5, angle: 0, moving: false };
    secretDoors = [];
    secretRooms = createSecretRooms();
    secretDoors = secretRooms;
    coins = placeCoins(base.coins + Math.floor((stage - 1) * .9));
    stageCoins = coins.length;
    weaponPickups = placeWeaponPickups();
    hasKey = false;
    objectiveText = isBossStage(stage) ? 'Derrote o guardião e pegue a chave' : 'Encontre a chave antiga';
    spawnEnemies();
    lootPickups = placeLootPickups();
    bullets = []; hostileBullets = []; particles = [];
    floatingTexts = []; combatPulse = 0; visitedAreas = new Set();
    reloadTimer = 0;
    navigation = createDistanceField(cols, rows, walkableCell);
    navigationDirty = true; lastPathUpdate = -Infinity;
    lastPlayerCell = `${Math.floor(player.x)},${Math.floor(player.y)}`;
    updateHUD(); renderer.resizeCanvas(); updateWeaponUI();
    levelLabel.textContent = `${base.label} · ${String(stage).padStart(2, '0')}/${MAX_STAGES}`;
    stageCounter.textContent = `FASE ${String(stage).padStart(2, '0')} / ${String(MAX_STAGES).padStart(2, '0')}`;
    gameStatus.textContent = stage === 1 ? base.status : `FASE ${stage} · ${base.label}`;
  }

  function showOverlay(el) { el.classList.remove('hidden'); }
  function hideOverlay(el) { el.classList.add('hidden'); }

  function togglePause(force) {
    if (!running || won || dead) return;
    paused = typeof force === 'boolean' ? force : !paused;
    if (paused) {
      showOverlay(pauseOverlay); gameStatus.textContent = 'JOGO PAUSADO'; pauseButton.textContent = '▶';
      keyState.clear(); mouseHeld = false;
      resumeButton.focus({ preventScroll: true });
    } else {
      hideOverlay(pauseOverlay); gameStatus.textContent = `FASE ${stage} · ${DIFFICULTIES[difficulty].label}`;
      pauseButton.textContent = 'Ⅱ'; startTime = performance.now() - elapsed;
      canvas.focus({ preventScroll: true });
      tone(620, .045, 'sine', .025);
    }
  }

  function returnToMenu() {
    running = false; paused = false; settingsOpen = false; pausedBeforeSettings = false;
    won = false; dead = false; mouseHeld = false; lastMouse = null; showMap = false;
    fireCooldown = 0; reloadTimer = 0; damageCooldown = 0; hitFlash = 0;
    bullets = []; hostileBullets = []; particles = []; floatingTexts = []; combatPulse = 0;
    keyState.clear(); player.moving = false;
    audioPlayer.setThreat(0);
    canvasWrap.classList.remove('playing');
    hideOverlay(pauseOverlay); hideOverlay(winOverlay); hideOverlay(deadOverlay); hideOverlay(settingsOverlay);
    showOverlay(startOverlay);
    pauseButton.disabled = true; pauseButton.textContent = 'Ⅱ';
    gameStatus.textContent = 'ESCOLHA SUA JORNADA'; lastIdleDraw = -Infinity;
    if (appShell) appShell.inert = true;
    titleScreen.inert = false; titleScreen.removeAttribute('aria-hidden');
    titleScreen.classList.remove('is-hidden');
    requestAnimationFrame(() => titleStartButton.focus({ preventScroll: true }));
  }

  function walkableCell(x, y) {
    if (y < 0 || x < 0 || y >= rows || x >= cols || !maze[y] || maze[y][x] === 1) return false;
    return !secretDoors.some(door => !door.opened && door.x === x && door.y === y);
  }

  function blockedAt(x, y, radius = .145) {
    const checks = [[x - radius, y - radius], [x + radius, y - radius], [x - radius, y + radius], [x + radius, y + radius]];
    return checks.some(([px, py]) => !walkableCell(Math.floor(px), Math.floor(py)));
  }

  function moveEntity(entity, dx, dy, radius = .225) {
    const oldX = entity.x, oldY = entity.y;
    // Substeps ensure no tunnelling through corners at high frame rates.
    const amount = Math.max(1, Math.ceil(Math.hypot(dx, dy) / .075));
    for (let i = 0; i < amount; i++) {
      const sx = dx / amount, sy = dy / amount;
      if (!blockedAt(entity.x + sx, entity.y, radius)) entity.x += sx;
      if (!blockedAt(entity.x, entity.y + sy, radius)) entity.y += sy;
    }
    return dist(oldX, oldY, entity.x, entity.y);
  }

  function updatePlayer(dt) {
    let dx = 0, dy = 0;
    if (keyState.has('a') || keyState.has('arrowleft')) dx -= 1;
    if (keyState.has('d') || keyState.has('arrowright')) dx += 1;
    if (keyState.has('w') || keyState.has('arrowup')) dy -= 1;
    if (keyState.has('s') || keyState.has('arrowdown')) dy += 1;
    if (dx || dy) {
      const length = Math.hypot(dx, dy) || 1;
      dx /= length; dy /= length;
      player.angle = Math.atan2(dy, dx);
      // A tight collision radius lets the traveler pass through one-tile corridors.
      const moved = moveEntity(player, dx * PLAYER_MOVE_SPEED * dt, dy * PLAYER_MOVE_SPEED * dt, .225);
      stepDistance += moved;
      if (stepDistance >= .8) { steps += Math.floor(stepDistance / .8); stepDistance %= .8; updateHUD(); }
      player.moving = moved > 0;
    } else player.moving = false;

    const cellX = Math.floor(player.x), cellY = Math.floor(player.y);
    const cell = cellKey(cellX, cellY);
    if (cell !== lastPlayerCell) {
      lastPlayerCell = cell;
      navigationDirty = true;
      const ember = coins.find(c => !c.taken && c.x === cellX && c.y === cellY);
      if (ember || coins.some(c => !c.taken && dist(player.x, player.y, c.x + .5, c.y + .5) < .42)) collectNearbyCoins();
    } else collectNearbyCoins();
    const region = maze[cellY]?.[cellX];
    if (region >= 2 && !visitedAreas.has(region)) {
      visitedAreas.add(region);
      const areas = { 2: ['CRIPTA ALAGADA', '#e6c88b'], 3: ['CAPELA ESQUECIDA', '#ffd98b'], 4: ['BOSQUE FÚNGICO', '#efad69'] };
      const [name, color] = areas[region];
      showPickupToast(`REGIÃO DESCOBERTA · ${name}`, 2300);
      showFloatingText(player.x, player.y, name, color, 1.8);
      tone(region === 2 ? 290 : region === 3 ? 460 : 350, .18, 'sine', .025);
    }
    if (cellX === exit.x && cellY === exit.y) {
      if (hasKey) finishLevel();
      else if (performance.now() - lastExitWarnAt > 1800) { showPickupToast(isBossStage(stage) ? 'O PORTÃO EXIGE A CHAVE DO GUARDIÃO' : 'PORTÃO TRANCADO · ENCONTRE A CHAVE'); lastExitWarnAt = performance.now(); tone(100,.09,'square',.022); }
    }
    collectWeaponPickups();
    collectLootPickups();
  }

  function collectNearbyCoins() {
    for (const coin of coins) {
      if (coin.taken || dist(player.x, player.y, coin.x + .5, coin.y + .5) > .43) continue;
      coin.taken = true; collected++;
      showFloatingText(coin.x + .5, coin.y + .5, collected % 3 === 0 && weaponInventory.size ? '+BRASA · +MUNIÇÃO' : '+1 BRASA', '#f6d17f');
      tone(630, .09, 'triangle', .035);
      setTimeout(() => tone(410, .1, 'sine', .025), 45);
      if (collected % 3 === 0) {
        for (const id of weaponInventory) if (ammo[id]) ammo[id].reserve += id === 'shotgun' ? 2 : id === 'ak' ? 12 : 6;
        showPickupToast(weaponInventory.size ? 'TRÊS BRASAS · MUNIÇÃO RESTAURADA' : 'TRÊS BRASAS REUNIDAS', 1300);
      }
      updateHUD(); updateWeaponUI();
    }
  }

  function setWeapon(id) {
    if (!WEAPONS[id] || !weaponInventory.has(id)) return;
    if (currentWeapon !== id && reloadTimer > 0) { reloadTimer = 0; gameStatus.textContent = 'ARMA EQUIPADA'; }
    currentWeapon = id; updateWeaponUI();
    showPickupToast(WEAPONS[id].name);
    tone(id === 'shotgun' ? 245 : id === 'ak' ? 180 : 410, .045, 'square', .018);
  }

  function updateWeaponUI() {
    if (!currentWeapon || !WEAPONS[currentWeapon]) {
      weaponName.textContent = 'SEM ARMA'; ammoCount.textContent = '—';
    } else {
      const weapon = WEAPONS[currentWeapon];
      weaponName.textContent = weapon.name;
      const slot = ammo[currentWeapon] || { mag: 0, reserve: 0 };
      ammoCount.textContent = `${slot.mag} / ${slot.reserve}`;
    }
    hud.updateAmmo(currentWeapon, ammo, WEAPONS, weaponInventory);
    weaponButtons.forEach(button => {
      const active = button.dataset.weapon === currentWeapon;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.disabled = !weaponInventory.has(button.dataset.weapon);
    });
  }

  function shoot() {
    if (!running || paused || won || dead || reloadTimer > 0 || fireCooldown > 0) return;
    if (!currentWeapon || !weaponInventory.has(currentWeapon)) return; // Torch-only until the first pickup.
    const weapon = WEAPONS[currentWeapon];
    if (bullets.length + weapon.pellets > MAX_BULLETS) return;
    const slot = ammo[currentWeapon];
    if (!slot || slot.mag <= 0) {
      if (slot && slot.reserve > 0) reload();
      else tone(85, .045, 'square', .025);
      return;
    }
    slot.mag--;
    fireCooldown = weapon.rate;
    const angleToUse = lastMouse && lastMouse.active ? Math.atan2(lastMouse.worldY - player.y, lastMouse.worldX - player.x) : player.angle;
    player.angle = angleToUse;
    if (weapon.sound === 'shotgun') {
      tone(105, .22, 'sawtooth', .052); setTimeout(() => tone(62, .12, 'triangle', .035), 25);
    } else if (weapon.sound === 'ak') {
      tone(92, .085, 'sawtooth', .035); setTimeout(() => tone(64, .045, 'square', .018), 14);
    } else {
      tone(160, .08, 'square', .028); setTimeout(() => tone(92, .035, 'triangle', .018), 18);
    }
    for (let i = 0; i < weapon.pellets; i++) {
      const spread = (Math.random() - .5) * weapon.spread * 2;
      const angle = angleToUse + spread;
      bullets.push({
        x: player.x + Math.cos(angle) * .23, y: player.y + Math.sin(angle) * .23,
        vx: Math.cos(angle) * weapon.speed, vy: Math.sin(angle) * weapon.speed,
        remainingRange: weapon.range, maxBounces: weapon.bounces, bounces: 0,
        damage: weapon.damage, color: weapon.color, size: currentWeapon === 'shotgun' ? .07 : .045
      });
    }
    const fx = player.x + Math.cos(angleToUse) * .48, fy = player.y + Math.sin(angleToUse) * .48;
    for (let i = 0; i < (currentWeapon === 'shotgun' ? 8 : 4); i++) {
      const a = angleToUse + (Math.random() - .5) * .9;
      particles.push({ x: fx, y: fy, vx: Math.cos(a) * (.8 + Math.random() * 2), vy: Math.sin(a) * (.8 + Math.random() * 2), life: .12 + Math.random() * .12, maxLife: .24, color: '#ffbf67', size: .035 });
    }
    updateWeaponUI();
  }

  function reload() {
    if (!running || paused || reloadTimer > 0 || !currentWeapon || !weaponInventory.has(currentWeapon)) return;
    const slot = ammo[currentWeapon], weapon = WEAPONS[currentWeapon];
    if (slot.mag >= weapon.magazine || slot.reserve <= 0) { tone(95, .04, 'triangle', .018); return; }
    reloadTimer = currentWeapon === 'shotgun' ? 1.05 : currentWeapon === 'ak' ? 1.25 : .9;
    gameStatus.textContent = 'RECARREGANDO';
    tone(260, .05, 'triangle', .02); setTimeout(() => tone(170, .06, 'square', .02), 180);
  }

  function finishReload() {
    const slot = ammo[currentWeapon], weapon = WEAPONS[currentWeapon];
    const amount = Math.min(weapon.magazine - slot.mag, slot.reserve);
    slot.mag += amount; slot.reserve -= amount; reloadTimer = 0;
    gameStatus.textContent = `FASE ${stage} · ${DIFFICULTIES[difficulty].label}`;
    updateWeaponUI(); tone(420, .05, 'triangle', .02);
  }

  function hasLineOfSight(ax, ay, bx, by) {
    // Traverse each crossed tile, including both sides of a diagonal corner.
    let x = Math.floor(ax), y = Math.floor(ay);
    const endX = Math.floor(bx), endY = Math.floor(by);
    if (!walkableCell(x, y) || !walkableCell(endX, endY)) return false;
    const dx = bx - ax, dy = by - ay;
    const sx = Math.sign(dx), sy = Math.sign(dy);
    const deltaX = dx ? Math.abs(1 / dx) : Infinity, deltaY = dy ? Math.abs(1 / dy) : Infinity;
    let edgeX = dx ? ((sx > 0 ? x + 1 : x) - ax) / dx : Infinity;
    let edgeY = dy ? ((sy > 0 ? y + 1 : y) - ay) / dy : Infinity;
    for (let steps = 0; (x !== endX || y !== endY) && steps < cols + rows; steps++) {
      if (Math.abs(edgeX - edgeY) < 1e-9) {
        if (!walkableCell(x + sx, y) || !walkableCell(x, y + sy)) return false;
        x += sx; y += sy; edgeX += deltaX; edgeY += deltaY;
      } else if (edgeX < edgeY) { x += sx; edgeX += deltaX; }
      else { y += sy; edgeY += deltaY; }
      if (!walkableCell(x, y)) return false;
    }
    return x === endX && y === endY;
  }

  function updateEnemies(dt, time) {
    const profile = COMBAT_DIFFICULTIES[combatDifficulty];
    // Player movement and door interaction dirty this shared field. At most one
    // rebuild per 90 ms, regardless of how many enemies are pursuing.
    if (navigation && navigationDirty && time - lastPathUpdate >= 90) {
      navigation.rebuild(player.x, player.y);
      navigationDirty = false; lastPathUpdate = time;
    }
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      enemy.flash = Math.max(0, enemy.flash - dt);
      let d = dist(enemy.x, enemy.y, player.x, player.y);
      // Distant enemies sleep until approached; there is no offscreen search or LOS work.
      if (d > 22 && enemy.attackAnim <= 0 && enemy.charge <= 0) continue;
      enemy.chase = d < (enemy.boss ? 16 : 13);

      if (enemy.charge > 0) {
        const home = maze[Math.floor(enemy.y)]?.[Math.floor(enemy.x)];
        const speed = (home === 2 || home === 3 ? 4.8 : 4.1) * profile.speed;
        const step = Math.min(dt, enemy.charge) * speed;
        const moved = moveEntity(enemy, Math.cos(enemy.chargeAngle) * step, Math.sin(enemy.chargeAngle) * step, .20);
        enemy.charge = Math.max(0, enemy.charge - dt);
        enemy.angle = enemy.chargeAngle; enemy.stepPhase += dt * 18;
        if (moved < step * .35) enemy.charge = 0;
        if (dist(enemy.x, enemy.y, player.x, player.y) < .66 && hasLineOfSight(enemy.x, enemy.y, player.x, player.y)) {
          if (damageCooldown <= 0) damagePlayer(enemy.damage);
          enemy.charge = 0;
        }
        continue;
      }

      if (enemy.attackAnim > 0) {
        enemy.attackAnim = Math.max(0, enemy.attackAnim - dt);
        enemy.angle = enemy.attackAim;
        if (enemy.attackAnim <= 0 && !enemy.attackHit) {
          enemy.attackHit = true;
          const attackMode = enemy.attackMode || (enemy.ranged ? 'shoot' : enemy.attackKind === 'dash' ? 'dash' : 'melee');
          if (attackMode === 'dash') {
            enemy.charge = .48; enemy.chargeAngle = enemy.attackAim;
            tone(190, .09, 'triangle', .025);
          } else if (attackMode === 'shoot') {
            if (!hasLineOfSight(enemy.x, enemy.y, enemy.attackTargetX ?? player.x, enemy.attackTargetY ?? player.y)) continue;
            const pattern = enemy.projectilePattern;
            const offsets = pattern === 'fan' ? [-.22, 0, .22] : pattern === 'twin' ? [-.10, .10] : pattern === 'spectral' ? [-.17, .17] : [0];
            const speed = (pattern === 'needle' ? 5.4 : pattern === 'arrow' ? 5.0 : pattern === 'fan' ? 3.6 : pattern === 'spectral' ? 4.0 : 4.4) * profile.projectileSpeed;
            for (const offset of offsets) {
              if (hostileBullets.length >= MAX_HOSTILE_BULLETS) break;
              const angle = enemy.attackAim + offset;
              const x = enemy.x + Math.cos(angle) * .28, y = enemy.y + Math.sin(angle) * .28;
              if (!hasLineOfSight(enemy.x, enemy.y, x, y)) continue;
              hostileBullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                damage: Math.max(2, Math.round(enemy.damage * (enemy.ranged ? 1 : enemy.boss ? .55 : .65))),
                color: pattern === 'fan' ? '#ef985d' : pattern === 'spectral' ? '#e4c88a' : '#f3c875', life: 2.6 });
            }
            tone(pattern === 'fan' ? 175 : 330, .09, 'triangle', .024);
          } else {
            d = dist(enemy.x, enemy.y, player.x, player.y);
            const reach = enemy.boss ? 1.28 : enemy.type === 'runner' ? .74 : .9;
            if (d < reach && damageCooldown <= 0 && hasLineOfSight(enemy.x, enemy.y, player.x, player.y)) damagePlayer(enemy.damage);
            if (enemy.boss && d < 2.6) {
              for (let i = 0; i < 8 && hostileBullets.length < MAX_HOSTILE_BULLETS; i++) {
                const angle = i * Math.PI / 4;
                hostileBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 3.2 * profile.projectileSpeed, vy: Math.sin(angle) * 3.2 * profile.projectileSpeed, damage: Math.max(2, Math.round((10 + stage) * profile.damage)), color: '#e88c60', life: 1.7 });
              }
            }
          }
        }
        continue;
      }

      const needsSight = enemy.chase && d < 10;
      if (needsSight && (time - enemy.sightAt > 180 || d < 1.2)) {
        enemy.canSee = hasLineOfSight(enemy.x, enemy.y, player.x, player.y);
        enemy.sightAt = time;
      } else if (!needsSight) enemy.canSee = false;

      if (time - enemy.pathAt > (enemy.chase ? 160 : 1000 * profile.cooldown)) {
        enemy.pathAt = time;
        if (enemy.ranged && enemy.chase && d > 3.8 && d < 8.2 && enemy.canSee) {
          enemy.targetX = enemy.x; enemy.targetY = enemy.y;
        } else if (enemy.chase) {
          const retreat = enemy.ranged && d <= 3.8 && enemy.canSee;
          const p = navigation?.nextStep(enemy.x, enemy.y, retreat);
          enemy.targetX = p ? p.x : enemy.x; enemy.targetY = p ? p.y : enemy.y;
        } else if (time > enemy.wanderAt) {
          const offset = randInt(4), dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
          for (let i = 0; i < 4; i++) {
            const [dx, dy] = dirs[(i + offset) % 4], nx = Math.floor(enemy.x) + dx, ny = Math.floor(enemy.y) + dy;
            if (walkableCell(nx, ny)) { enemy.targetX = nx + .5; enemy.targetY = ny + .5; break; }
          }
          enemy.wanderAt = time + (1000 + Math.random() * 700) * profile.cooldown;
        }
      }
      const vx = enemy.targetX - enemy.x, vy = enemy.targetY - enemy.y;
      const length = Math.hypot(vx, vy);
      if (length > .06) {
        const step = Math.min(enemy.speed * dt, length);
        const moved = moveEntity(enemy, vx / length * step, vy / length * step, enemy.boss ? .31 : .20);
        if (moved > 0) { enemy.angle = Math.atan2(vy, vx); enemy.stepPhase += dt * (enemy.type === 'runner' ? 16 : 10); }
      }
      d = dist(enemy.x, enemy.y, player.x, player.y);
      const aim = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const rangedReady = enemy.chase && d < 9.4 && d > (enemy.ranged ? 3.1 : 2.4) && enemy.canSee && time - enemy.shotAt > enemy.shotCooldown;
      const dashReady = enemy.attackKind === 'dash' && d > 1.3 && d < 5.5 && enemy.canSee && time - enemy.attackAt > enemy.dashCooldown;
      const meleeReady = !enemy.ranged && d < (enemy.boss ? 1.75 : enemy.type === 'runner' ? .72 : .82) && enemy.canSee && time - enemy.attackAt > enemy.meleeCooldown;
      if (rangedReady || dashReady || meleeReady) {
        // Lock the direction during the full windup so the attack can be read and dodged.
        enemy.attackMode = meleeReady ? 'melee' : dashReady ? 'dash' : 'shoot';
        enemy.attackAt = time; if (enemy.attackMode === 'shoot') enemy.shotAt = time;
        enemy.attackAim = aim; enemy.chargeAngle = aim; enemy.angle = aim;
        enemy.attackTargetX = player.x; enemy.attackTargetY = player.y;
        enemy.attackMax = enemy.attackMode === 'shoot' ? enemy.projectileWindup : enemy.windup;
        enemy.attackAnim = enemy.attackMax; enemy.attackHit = false;
        enemy.targetX = enemy.x; enemy.targetY = enemy.y;
        tone(enemy.boss ? 82 : enemy.attackKind === 'dash' ? 290 : enemy.ranged ? 245 : 145, .08, 'triangle', .022);
      }
    }
  }

  function updateHostileBullets(dt) {
    for (let i=hostileBullets.length-1;i>=0;i--) {
      const b=hostileBullets[i]; b.life-=dt;
      const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/.07));
      let removed=b.life<=0;
      for(let part=0;part<steps&&!removed;part++) {
        const nx=b.x+b.vx*dt/steps, ny=b.y+b.vy*dt/steps;
        if(!walkableCell(Math.floor(nx),Math.floor(ny)) || !hasLineOfSight(b.x,b.y,nx,ny)) {
          for(let p=0;p<3;p++) particles.push({x:b.x,y:b.y,vx:(Math.random()-.5)*1.5,vy:(Math.random()-.5)*1.5,life:.16,maxLife:.16,color:b.color,size:.035});
          removed=true; break;
        }
        b.x=nx;b.y=ny;
        if(dist(b.x,b.y,player.x,player.y)<.28) {
          if(damageCooldown<=0) damagePlayer(b.damage||8,'projectile');
          for(let p=0;p<5;p++) particles.push({x:b.x,y:b.y,vx:(Math.random()-.5)*2,vy:(Math.random()-.5)*2,life:.22,maxLife:.22,color:'#d84c38',size:.045});
          removed=true; break;
        }
      }
      if(removed)hostileBullets.splice(i,1);
    }
  }

  function rebuildEnemyBuckets() {
    const width = Math.ceil(cols / 2), height = Math.ceil(rows / 2);
    if (!enemyBucketHeads || enemyBucketCols !== width || enemyBucketRows !== height) {
      enemyBucketCols = width; enemyBucketRows = height;
      enemyBucketHeads = new Int16Array(width * height);
    }
    if (!enemyBucketNext || enemyBucketNext.length < enemies.length) enemyBucketNext = new Int16Array(Math.max(MAX_ENEMIES, enemies.length));
    enemyBucketHeads.fill(-1);
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (!enemy.alive) continue;
      const x = Math.floor(enemy.x / 2), y = Math.floor(enemy.y / 2);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const bucket = y * width + x;
      enemyBucketNext[i] = enemyBucketHeads[bucket]; enemyBucketHeads[bucket] = i;
    }
  }

  function enemyAtBullet(x, y) {
    const minX = Math.max(0, Math.floor((x - .53) / 2)), maxX = Math.min(enemyBucketCols - 1, Math.floor((x + .53) / 2));
    const minY = Math.max(0, Math.floor((y - .53) / 2)), maxY = Math.min(enemyBucketRows - 1, Math.floor((y + .53) / 2));
    for (let by = minY; by <= maxY; by++) for (let bx = minX; bx <= maxX; bx++) {
      for (let index = enemyBucketHeads[by * enemyBucketCols + bx]; index >= 0; index = enemyBucketNext[index]) {
        const enemy = enemies[index], dx = x - enemy.x, dy = y - enemy.y;
        const radius = enemy.boss ? .52 : .30;
        if (enemy.alive && dx * dx + dy * dy < radius * radius) return enemy;
      }
    }
    return null;
  }

  function updateBullets(dt) {
    if (!bullets.length) return;
    rebuildEnemyBuckets();
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      let removed = false;
      const speed = Math.hypot(b.vx, b.vy) || 1;
      const pieces = Math.max(1, Math.ceil(speed * dt / .035));
      const pieceTime = dt / pieces;
      for (let part = 0; part < pieces && !removed; part++) {
        if (b.remainingRange <= 0 || b.bounces > b.maxBounces) { removed = true; break; }
        const currentSpeed = Math.hypot(b.vx, b.vy) || 1;
        const stepDistance = Math.min(currentSpeed * pieceTime, b.remainingRange);
        const dx = (b.vx / currentSpeed) * stepDistance;
        const dy = (b.vy / currentSpeed) * stepDistance;
        let bounced = false;

        // Resolve each axis independently so a shot rebounds with the correct
        // reflected component instead of being deleted on first wall contact.
        const testX = b.x + dx;
        if (walkableCell(Math.floor(testX), Math.floor(b.y))) b.x = testX;
        else { b.vx = -b.vx; bounced = true; }

        const testY = b.y + dy;
        if (walkableCell(Math.floor(b.x), Math.floor(testY))) b.y = testY;
        else { b.vy = -b.vy; bounced = true; }

        b.remainingRange -= stepDistance;
        if (bounced) {
          b.bounces++;
          for (let k = 0; k < 3; k++) {
            particles.push({ x: b.x, y: b.y, vx: (Math.random() - .5) * 2.5, vy: (Math.random() - .5) * 2.5,
              life: .12 + Math.random() * .08, maxLife: .2, color: k ? b.color : '#ffe1a0', size: .035 });
          }
          if (wallBounceCooldown <= 0) {
            tone(420 + Math.random() * 220, .035, 'square', .012);
            wallBounceCooldown = .045;
          }
          if (b.bounces > b.maxBounces) { removed = true; break; }
        }

        const target = enemyAtBullet(b.x, b.y);
        if (target) {
          target.hp -= b.damage; target.flash = .12; target.hurtAt = performance.now(); removed = true;
          combatPulse = Math.max(combatPulse, .26);
          if (performance.now() - (target.lastDamageText || 0) > 110) {
            showFloatingText(target.x, target.y, `${Math.round(b.damage)}`, '#efd7b1', .60);
            target.lastDamageText = performance.now();
          }
          particles.push({ x: b.x, y: b.y, vx: (Math.random() - .5) * 1.2, vy: (Math.random() - .5) * 1.2, life: .25, maxLife: .25, color: '#a9362e', size: .06 });
          tone(230 + Math.random() * 90, .055, 'triangle', .025);
          if (target.hp <= 0) {
            target.alive = false; kills++;
            combatPulse = target.boss ? 1 : .5;
            showFloatingText(target.x, target.y - .25, target.boss ? 'GUARDIÃO DERROTADO' : 'DERROTADO', target.boss ? '#ffd88d' : '#e4cda2', target.boss ? 1.7 : .85);
            dropEnemyLoot(target);
            for (let n = 0; n < (target.boss ? 28 : 9); n++) particles.push({ x: target.x, y: target.y, vx: (Math.random() - .5) * 2.4, vy: (Math.random() - .5) * 2.4, life: .35 + Math.random() * .25, maxLife: .6, color: n % 2 ? '#b6ad8d' : '#7e3127', size: .04 + Math.random() * .035 });
            if (currentWeapon && ammo[currentWeapon] && Math.random() < .20) ammo[currentWeapon].reserve += currentWeapon === 'shotgun' ? 2 : currentWeapon === 'pistol' ? 5 : 9;
            tone(95, .12, 'sawtooth', .032); updateHUD(); updateWeaponUI();
          }
        }
        if (b.remainingRange <= 0) removed = true;
      }
      if (removed) bullets.splice(i, 1);
    }
  }

  function updateParticles(dt) {
    if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
    combatPulse = Math.max(0, combatPulse - dt * 3);
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const text = floatingTexts[i]; text.life -= dt; text.y -= dt * .35;
      if (text.life <= 0) floatingTexts.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.vx *= .97; p.vy *= .97;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function finishLevel() {
    if (won || dead) return;
    won = true; running = false; paused = false; elapsed = performance.now() - startTime;
    finalTime.textContent = formatTime(elapsed); finalCoins.textContent = `${collected}/${stageCoins}`;
    if (stage >= MAX_STAGES) {
      clearCampaignSave(); if (titleContinueButton) titleContinueButton.classList.add('hidden');
      winHeadline.innerHTML = 'Você venceu<br /><em>as catacumbas.</em>';
      winCopy.textContent = 'Oito labirintos ficaram para trás. A chama ainda vive — por enquanto.';
      nextButton.innerHTML = 'Jogar campanha novamente <span>↻</span>';
    } else {
      saveCampaign({ stage: stage + 1, difficulty, combatDifficulty, kills, elapsed, health: Math.min(100, health + 20), inventory: [...weaponInventory], currentWeapon, ammo, completedStages: stage });
      const checkpoint = loadCampaignSave(); if (checkpoint && titleContinueButton) { titleContinueButton.classList.remove('hidden'); titleContinueButton.innerHTML = `CONTINUAR CAMPANHA · FASE ${String(checkpoint.stage).padStart(2,'0')} <span>↗</span>`; }
      winHeadline.innerHTML = 'Você encontrou<br /><em>a passagem.</em>';
      winCopy.textContent = `Fase ${stage} concluída. Seu progresso foi salvo. A próxima região terá novas ameaças.`;
      nextButton.innerHTML = 'Entrar na próxima fase <span>→</span>';
    }
    showOverlay(winOverlay); pauseButton.disabled = true; gameStatus.textContent = 'SAÍDA ENCONTRADA';
    nextButton.focus({ preventScroll: true });
    tone(520, .12, 'triangle', .04); setTimeout(() => tone(690, .14, 'triangle', .04), 110); setTimeout(() => tone(900, .22, 'sine', .04), 230);
  }

  function gameOver() {
    dead = true; running = false; paused = false; mouseHeld = false; keyState.clear();
    showOverlay(deadOverlay); pauseButton.disabled = true; gameStatus.textContent = 'A CHAMA SE APAGOU';
    retryButton.focus({ preventScroll: true });
    tone(72, .5, 'sawtooth', .055);
  }

  function nextLevel() {
    if (stage >= MAX_STAGES) { stage = 1; newGame(true); return; }
    stage++;
    // Keep campaign total time/statistics across stage transitions.
    const previousElapsed = elapsed;
    collected = 0;
    createLevel(); elapsed = previousElapsed; startTime = performance.now() - elapsed;
    won = false; dead = false; paused = false; running = true; health = Math.min(100, health + 20);
    hideOverlay(winOverlay); pauseButton.disabled = false; pauseButton.textContent = 'Ⅱ';
    canvas.focus({ preventScroll: true });
    updateHUD(); tone(330, .12, 'triangle', .03);
  }

  function retryStage() { newGame(false, true); }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function updateHUD() {
    if (hudValues.health !== health) {
      hudValues.health = health; hud.updateHealth(health);
      healthValue.textContent = `${health}%`; healthBar.style.transform = `scaleX(${health / 100})`;
    }
    const seconds = Math.floor(elapsed / 1000);
    if (hudValues.seconds !== seconds) {
      hudValues.seconds = seconds;
      const timeText = formatTime(elapsed);
      timerValue.innerHTML = `${timeText.slice(0, 2)}<span>:</span>${timeText.slice(3)}`;
      timerBar.style.transform = `scaleX(${1 - Math.min(elapsed / 480000, .9)})`;
    }
    if (hudValues.coins !== collected || hudValues.stageCoins !== stageCoins) {
      hudValues.coins = collected; hudValues.stageCoins = stageCoins;
      coinCount.innerHTML = `${collected} <small>/ ${stageCoins}</small>`;
    }
    if (hudValues.steps !== steps) { hudValues.steps = steps; stepCount.textContent = steps; }
    if (hudValues.kills !== kills) { hudValues.kills = kills; killCount.textContent = kills; }
    let alive = 0;
    for (const enemy of enemies) if (enemy.alive) alive++;
    if (hudValues.alive !== alive) { hudValues.alive = alive; enemyCount.textContent = alive; }
  }

  function toggleSettings() {
    if (settingsOpen) { closeSettings(); return; }
    settingsOpen = true; pausedBeforeSettings = paused;
    if (volumeSetting) volumeSetting.value = String(settings.volume ?? .65);
    if (brightnessSetting) brightnessSetting.value = String(brightness);
    if (motionSetting) motionSetting.checked = reducedMotion;
    keyState.clear(); mouseHeld = false;
    showOverlay(settingsOverlay);
    soundSetting?.focus({ preventScroll: true });
  }

  function closeSettings() {
    settingsOpen = false; hideOverlay(settingsOverlay);
    settings = { sound: soundOn, volume: Number(volumeSetting?.value ?? .65), brightness, reducedMotion, graphicsQuality, showFps };
    audioPlayer.setVolume(settings.volume);
    saveSettings(settings);
    if (!pausedBeforeSettings && !paused && running) startTime = performance.now() - elapsed;
    pausedBeforeSettings = false;
    (won ? nextButton : dead ? retryButton : paused ? resumeButton : running ? canvas : startButton).focus({ preventScroll: true });
  }

  function trapDialogFocus(event, dialog) {
    const controls = [...dialog.querySelectorAll('button:not(:disabled), input, select')]
      .filter(control => getComputedStyle(control).visibility === 'visible' && control.getClientRects().length);
    if (!controls.length) return;
    event.preventDefault();
    const index = controls.indexOf(document.activeElement);
    const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0)
      : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    controls[next].focus();
  }

  function handleKeyDown(event) {
    const key = event.key.toLowerCase();
    // Native controls keep their own keyboard behavior inside menus.
    const onControl = event.target?.matches?.('button, select, input');
    if (!titleScreen.classList.contains('is-hidden')) {
      if (key === 'tab') { trapDialogFocus(event, titleScreen); return; }
      if ((key === 'enter' || key === ' ') && !event.repeat && !onControl) { event.preventDefault(); titleStartButton.click(); }
      return;
    }
    const activeDialog = settingsOpen ? settingsOverlay : paused ? pauseOverlay : won ? winOverlay : dead ? deadOverlay : !running ? startOverlay : null;
    if (key === 'tab' && activeDialog) { trapDialogFocus(event, activeDialog); return; }
    if (settingsOpen) { if ((key === 'escape' || key === 'o') && !event.repeat) closeSettings(); return; }
    if (key === 'o' && !event.repeat) { toggleSettings(); return; }
    if (key === 'm' && running && !event.repeat) { showMap = !showMap; showPickupToast(showMap ? 'MAPA ABERTO' : 'MAPA FECHADO', 750); return; }
    if (onControl && key !== 'escape' && (!running || paused || won || dead)) return;
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) event.preventDefault();
    if (key === 'escape' || key === ' ') { if (running && !won && !dead) togglePause(); return; }
    if (key === 'e') { tryInteract(); return; }
    if (key === 'r') { reload(); return; }
    if (key === 'f' || key === 'j') { keyState.add(key); shoot(); return; }
    if (key === '1') { setWeapon('pistol'); return; }
    if (key === '2') { setWeapon('shotgun'); return; }
    if (key === '3') { setWeapon('ak'); return; }
    if (key === 'enter' && won) { event.preventDefault(); nextLevel(); return; }
    if (key === 'enter' && dead) { event.preventDefault(); retryStage(); return; }
    if (key === 'enter' && !running) { event.preventDefault(); newGame(true); return; }
    if (paused || !running || won || dead) return;
    keyState.add(key);
  }

  function handleKeyUp(event) { keyState.delete(event.key.toLowerCase()); }

  canvas.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse' && running && !paused) {
      lastMouse = renderer.pointerWorld(event);
      player.angle = Math.atan2(lastMouse.worldY - player.y, lastMouse.worldX - player.x);
    }
  });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    if (!running && !won && !dead) return;
    if (paused) return;
    canvas.setPointerCapture?.(event.pointerId);
    lastMouse = renderer.pointerWorld(event); player.angle = Math.atan2(lastMouse.worldY - player.y, lastMouse.worldX - player.x);
    mouseHeld = true; shoot();
  });
  window.addEventListener('pointerup', () => { mouseHeld = false; });
  window.addEventListener('blur', () => { mouseHeld = false; keyState.clear(); if (running && !paused && !won && !dead) togglePause(true); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { lastFrame = 0; return; }
    mouseHeld = false; keyState.clear();
    if (running && !paused && !won && !dead) togglePause(true);
  });

  function bindTouchControls() {
    const controls = document.createElement('div'); controls.className = 'touch-controls'; controls.setAttribute('aria-label','Controles de movimento');
    controls.innerHTML = '<button type="button" data-dir="up" aria-label="Mover para cima">↑</button><div><button type="button" data-dir="left" aria-label="Mover para esquerda">←</button><button type="button" data-dir="down" aria-label="Mover para baixo">↓</button><button type="button" data-dir="right" aria-label="Mover para direita">→</button></div><button type="button" class="touch-fire" data-fire="true">ATIRAR</button>';
    canvasWrap.insertAdjacentElement('afterend',controls);
    const mapping = { up: ['w'], down: ['s'], left: ['a'], right: ['d'] };
    controls.querySelectorAll('[data-dir]').forEach(button => {
      const keys = mapping[button.dataset.dir];
      const press = event => { event.preventDefault(); if (!running && !won && !dead) newGame(true); keys.forEach(k => keyState.add(k)); };
      const release = event => { event.preventDefault(); keys.forEach(k => keyState.delete(k)); };
      button.addEventListener('pointerdown',press); button.addEventListener('pointerup',release); button.addEventListener('pointercancel',release); button.addEventListener('pointerleave',release);
    });
    const fireButton = controls.querySelector('[data-fire]');
    fireButton.addEventListener('pointerdown',event => { event.preventDefault(); keyState.add('f'); shoot(); });
    ['pointerup','pointercancel','pointerleave'].forEach(type => fireButton.addEventListener(type,() => keyState.delete('f')));
  }

  function leaveTitle() {
    if (appShell) appShell.inert = false;
    difficultySelect.focus({ preventScroll: true });
    titleScreen.inert = true;
    titleScreen.setAttribute('aria-hidden', 'true');
    titleScreen.classList.add('is-hidden');
    lastIdleDraw = -Infinity;
  }
  titleStartButton.addEventListener('click', leaveTitle);
  titleContinueButton?.addEventListener('click', () => {
    if (!loadCampaignSave()) { titleContinueButton.classList.add('hidden'); return; }
    leaveTitle();
    newGame(false, true);
  });
  closeSettingsButton?.addEventListener('click', closeSettings);
  soundSetting?.addEventListener('change', () => { soundOn = soundSetting.checked; settings.sound = soundOn; if (soundButton) { soundButton.classList.toggle('sound-muted', !soundOn); soundButton.textContent = soundOn ? '♫' : '♪̸'; } persistSettings(); if (soundOn) tone(660,.06,'sine',.03); });
  volumeSetting?.addEventListener('input', () => { settings.volume = Number(volumeSetting.value); audioPlayer.setVolume(settings.volume); persistSettings(); });
  brightnessSetting?.addEventListener('input', () => { brightness = Number(brightnessSetting.value); settings.brightness = brightness; persistSettings(); });
  motionSetting?.addEventListener('change', () => { reducedMotion = motionSetting.checked; settings.reducedMotion = reducedMotion; titleScene.setReducedMotion(reducedMotion); selectionScene.setReducedMotion(reducedMotion); document.body.dataset.reducedMotion = String(reducedMotion); persistSettings(); });
  graphicsQualitySetting?.addEventListener('change', () => { graphicsQuality = graphicsQualitySetting.value; persistSettings(); lastIdleDraw = -Infinity; });
  fpsSetting?.addEventListener('change', () => { showFps = fpsSetting.checked; fpsFrames = 0; fpsWindowStart = 0; persistSettings(); });
  startButton.addEventListener('click',() => newGame(true));
  resumeButton.addEventListener('click',() => togglePause(false));
  pauseMenuButton?.addEventListener('click', returnToMenu);
  nextButton.addEventListener('click',nextLevel);
  retryButton.addEventListener('click', retryStage);
  restartButton.addEventListener('click',() => newGame(true));
  pauseButton.addEventListener('click',() => togglePause());
  soundButton.addEventListener('click',() => {
    soundOn = !soundOn; if (soundSetting) soundSetting.checked = soundOn; soundButton.classList.toggle('sound-muted',!soundOn);
    soundButton.title = soundOn ? 'Som ligado' : 'Som desligado'; soundButton.setAttribute('aria-label',soundOn ? 'Desativar sons' : 'Ativar sons'); soundButton.textContent = soundOn ? '♫' : '♪̸';
    settings.sound = soundOn; persistSettings();
    if (soundOn) tone(660,.06,'sine',.03);
  });
  weaponButtons.forEach(button => button.addEventListener('click',() => setWeapon(button.dataset.weapon)));
  hudWeaponButtons.forEach(button => button.addEventListener('click', () => {
    if (!running || paused || settingsOpen || won || dead) return;
    setWeapon(button.dataset.hudWeapon);
    canvas.focus({ preventScroll: true });
  }));
  difficultySelect.addEventListener('change',() => {
    const settings = DIFFICULTIES[difficultySelect.value]; levelLabel.textContent = `${settings.label} · 01/${MAX_STAGES}`;
  });
  document.addEventListener('keydown',handleKeyDown); document.addEventListener('keyup',handleKeyUp);
  window.addEventListener('resize',() => renderer.resizeCanvas());

  function frame(time) {
    const titleVisible = !titleScreen.classList.contains('is-hidden');
    const selectionActive = !document.hidden && !titleVisible && !startOverlay.classList.contains('hidden') && !settingsOpen;
    if (selectionActive !== selectionSceneActive) {
      selectionSceneActive = selectionActive;
      selectionScene.setActive?.(selectionActive);
    }
    if (document.hidden || titleVisible || selectionActive) {
      lastFrame = time; fpsFrames = 0; fpsWindowStart = 0;
      performanceReadout?.classList.add('hidden');
      requestAnimationFrame(frame); return;
    }
    const dtMs = lastFrame ? Math.min(time - lastFrame, 40) : 16; lastFrame = time;
    const dt = dtMs / 1000;
    const playing = running && !paused && !settingsOpen && !won && !dead;
    if (playing) {
      elapsed = time - startTime;
      fireCooldown = Math.max(0,fireCooldown - dtMs); damageCooldown = Math.max(0,damageCooldown - dt); hitFlash = Math.max(0,hitFlash - dt); wallBounceCooldown = Math.max(0, wallBounceCooldown - dt);
      if (reloadTimer > 0) { reloadTimer -= dt; if (reloadTimer <= 0) finishReload(); }
      updatePlayer(dt); updateEnemies(dt,time); updateBullets(dt); updateHostileBullets(dt); updateParticles(dt);
      if (time - lastThreatCheck > 300) {
        const nearestThreat = enemies.filter(e => e.alive).reduce((best,e) => Math.min(best,dist(e.x,e.y,player.x,player.y)), 99);
        audioPlayer.setThreat(nearestThreat < 3 ? 1 : nearestThreat < 6 ? .68 : nearestThreat < 10 ? .3 : 0);
        lastThreatCheck = time;
      }
      if (player.moving && elapsed - (player.lastFootstepAt || 0) > 330) { player.lastFootstepAt = elapsed; const surface=maze[Math.floor(player.y)]?.[Math.floor(player.x)]; tone(surface===2?92:surface===3?145:surface===4?210:115,.035,'triangle',.012); }
      if (mouseHeld || keyState.has('f') || keyState.has('j')) shoot();
      updateHUD();
    } else updateParticles(dt);
    if (playing || time - lastIdleDraw >= 100) { renderer.draw(time); lastIdleDraw = time; }
    performanceReadout?.classList.toggle('hidden', !showFps || !playing);
    if (showFps && playing) {
      if (!fpsWindowStart) { fpsWindowStart = time; fpsFrames = 0; }
      else fpsFrames++;
      if (time - fpsWindowStart >= 500) {
        const metrics = renderer.getMetrics();
        const quality = metrics.quality === 'low' ? 'LEVE' : 'ALTA';
        performanceReadout.textContent = `${Math.round(fpsFrames * 1000 / (time - fpsWindowStart))} FPS · ${metrics.renderMs.toFixed(1)} ms · ${quality}`;
        fpsWindowStart = time; fpsFrames = 0;
      }
    } else { fpsWindowStart = 0; fpsFrames = 0; }
    requestAnimationFrame(frame);
  }

  // Show a small section of the procedural dungeon behind the start screen.
  maze = widenMaze(makeMaze(cols, rows)); rows = maze.length; cols = maze[0].length;
  exit = { x: cols - 3, y: rows - 3 }; maze[exit.y][exit.x] = 0;
  player = { x: 2.5, y: 2.5, angle: 0, moving: false };
  coins = placeCoins(DIFFICULTIES.normal.coins); stageCoins = coins.length;
  const savedCampaign = loadCampaignSave();
  if (savedCampaign && titleContinueButton) { titleContinueButton.classList.remove('hidden'); titleContinueButton.innerHTML = `CONTINUAR CAMPANHA · FASE ${String(savedCampaign.stage).padStart(2,'0')} <span>↗</span>`; }
  ammo = {}; weaponInventory = new Set(); currentWeapon = null; weaponPickups = [];
  renderer.resizeCanvas(); updateHUD(); updateWeaponUI(); bindTouchControls();
  document.body.dataset.reducedMotion = String(reducedMotion);
  titleStartButton.focus({ preventScroll: true });
  requestAnimationFrame(frame);
})();
