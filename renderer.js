// Pixel-art rendering, camera tracking, lighting and canvas sizing live here.
export function createRenderer({ canvas, canvasWrap, getState }) {
  const ctx = canvas.getContext('2d');
  const darknessCanvas = document.createElement('canvas');
  const darknessCtx = darknessCanvas.getContext('2d');

  let maze = [], cols = 29, rows = 21;
  let player = { x: 1.5, y: 1.5, angle: 0, moving: false };
  let exit = { x: 27, y: 19 }, coins = [], weaponPickups = [], lootPickups = [], secretDoors = [], enemies = [], bullets = [], hostileBullets = [], particles = [];
  let hasKey = false, objectiveText = '', showMap = false, brightness = .5, reducedMotion = false;
  let pickupToast = '', pickupToastUntil = 0, hitFlash = 0;
  let tile = 24, offsetX = 0, offsetY = 0, viewWidth = 0, viewHeight = 0;
  let mapMarks = [], decorations = [], ambientLights = [], lastMazeRef = null, projectileLights = [];
  const schoolLogo = new Image();
  schoolLogo.decoding = 'async';
  schoolLogo.src = new URL('../assets/colegio-logo.png', import.meta.url).href;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const noiseAt = (x, y, salt = 0) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };

  function refreshState() {
    const state = getState();
    const nextMaze = state.maze;
    const mazeChanged = nextMaze !== lastMazeRef;
    maze = nextMaze; cols = state.cols; rows = state.rows; player = state.player; exit = state.exit;
    coins = state.coins; weaponPickups = state.weaponPickups; lootPickups = state.lootPickups || []; secretDoors = state.secretDoors || []; enemies = state.enemies;
    bullets = state.bullets; hostileBullets = state.hostileBullets || []; particles = state.particles; pickupToast = state.pickupToast;
    hasKey = !!state.hasKey; objectiveText = state.objectiveText || ''; showMap = !!state.showMap; brightness = Number(state.brightness ?? .5); reducedMotion = !!state.reducedMotion;
    pickupToastUntil = state.pickupToastUntil; hitFlash = state.hitFlash;
    if (mazeChanged) { lastMazeRef = nextMaze; rebuildMapMarks(); }
  }

  function renderResizeCanvas() {
    const rect = canvasWrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewWidth = Math.max(1, rect.width); viewHeight = Math.max(1, rect.height);
    canvas.width = Math.round(viewWidth * dpr); canvas.height = Math.round(viewHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    darknessCanvas.width = Math.max(1, Math.ceil(viewWidth)); darknessCanvas.height = Math.max(1, Math.ceil(viewHeight));
    tile = clamp(Math.floor(Math.min(viewWidth / 19, viewHeight / 12.5)), 15, 34);
    updateCamera();
  }

  function updateCamera() {
    const worldW = cols * tile, worldH = rows * tile;
    offsetX = worldW <= viewWidth ? (viewWidth - worldW) / 2 : clamp(viewWidth / 2 - player.x * tile, viewWidth - worldW, 0);
    offsetY = worldH <= viewHeight ? (viewHeight - worldH) / 2 : clamp(viewHeight / 2 - player.y * tile, viewHeight - worldH, 0);
  }

  function screenPoint(x, y) { return { x: offsetX + x * tile, y: offsetY + y * tile }; }

  function rebuildMapMarks() {
    mapMarks = [];
    if (!maze || !maze.length || !rows || !cols) {
      decorations = [];
      return;
    }

    // Find broad open pockets so the school emblem and class tag sit naturally in the ruins.
    const candidates = [];
    for (let y = 1; y < rows - 2; y++) {
      for (let x = 1; x < cols - 2; x++) {
        if (maze[y][x] !== 0 || maze[y][x + 1] !== 0 || maze[y + 1][x] !== 0 || maze[y + 1][x + 1] !== 0) continue;
        const mark = { x: x + 1, y: y + 1, rank: noiseAt(x, y, cols * 3 + rows) };
        if (player && Math.hypot(mark.x - player.x, mark.y - player.y) < 5.5) continue;
        if (exit && Math.hypot(mark.x - (exit.x + .5), mark.y - (exit.y + .5)) < 4.5) continue;
        candidates.push(mark);
      }
    }
    candidates.sort((a, b) => a.rank - b.rank);
    for (const candidate of candidates) {
      if (mapMarks.some(mark => Math.hypot(mark.x - candidate.x, mark.y - candidate.y) < 5.6)) continue;
      mapMarks.push({ x: candidate.x, y: candidate.y });
      if (mapMarks.length >= 5) break;
    }
    rebuildDecorations();
  }

  function rebuildDecorations() {
    decorations = [];
    if (!maze || !maze.length) return;
    const candidates = [];
    const themedCells = new Map([[2, []], [3, []], [4, []]]);

    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const cell = maze[y][x];
        if (cell === 1) continue;
        const theme = cell >= 2 && cell <= 4 ? cell : 0;
        if (theme) themedCells.get(theme).push({ x, y });
        const wx = x + .5, wy = y + .5;
        if (player && Math.hypot(wx - player.x, wy - player.y) < 2.4) continue;
        if (exit && Math.hypot(wx - (exit.x + .5), wy - (exit.y + .5)) < 2.0) continue;
        if (mapMarks.some(mark => Math.hypot(wx - mark.x, wy - mark.y) < 1.35)) continue;

        const detail = noiseAt(x, y, 44);
        let type = '';
        if (theme === 2) {
          if (detail > .91) type = 'water-ripple';
          else if (detail > .84) type = 'submerged-rubble';
          else if (detail > .77) type = 'puddle';
          else if (detail > .72) type = 'seaweed';
          else if (detail > .67) type = 'bones';
        } else if (theme === 3) {
          if (detail > .972) type = 'broken-pillar';
          else if (detail > .945) type = 'pew';
          else if (detail > .91) type = 'chapel-candle';
          else if (detail > .86) type = 'debris';
          else if (detail > .82) type = 'stain';
        } else if (theme === 4) {
          if (detail > .86) type = 'fungus';
          else if (detail > .78) type = 'glow-spores';
          else if (detail > .73) type = 'roots';
          else if (detail > .68) type = 'rubble';
        } else {
          // The ordinary tunnels stay varied too, but the set-piece rooms keep
          // their own visual language and higher density of themed dressing.
          if (detail > .989) type = 'lantern';
          else if (detail > .971) type = 'fungus';
          else if (detail > .936) type = 'bones';
          else if (detail > .880) type = 'puddle';
          else if (detail > .821) type = 'rubble';
          else if (detail > .779) type = 'debris';
          else if (detail > .742) type = 'stain';
        }
        if (!type) continue;
        candidates.push({ x, y, type, theme, rank: noiseAt(x, y, 77), phase: noiseAt(x, y, 91) * Math.PI * 2 });
      }
    }

    // Guaranteed landmarks make each special room immediately recognizable.
    const landmarks = [
      { theme: 2, type: 'sarcophagus' },
      { theme: 3, type: 'altar' },
      { theme: 4, type: 'fungus-heart' }
    ];
    for (const landmark of landmarks) {
      const cells = themedCells.get(landmark.theme) || [];
      if (!cells.length) continue;
      const centerX = cells.reduce((sum, p) => sum + p.x, 0) / cells.length;
      const centerY = cells.reduce((sum, p) => sum + p.y, 0) / cells.length;
      const interior = cells.filter(p => {
        const neighbors = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy]) => maze[p.y+dy]?.[p.x+dx] === landmark.theme).length;
        const px = p.x + .5, py = p.y + .5;
        return neighbors >= 3 && (!player || Math.hypot(px-player.x,py-player.y) > 3.3) &&
          (!exit || Math.hypot(px-(exit.x+.5),py-(exit.y+.5)) > 2.6) &&
          !mapMarks.some(mark => Math.hypot(px-mark.x,py-mark.y) < 1.8);
      });
      const pool = interior.length ? interior : cells;
      pool.sort((a,b) => Math.hypot(a.x-centerX,a.y-centerY) - Math.hypot(b.x-centerX,b.y-centerY));
      const point = pool[0];
      if (point) candidates.push({ x: point.x, y: point.y, type: landmark.type, theme: landmark.theme, rank: -10, phase: .4 + landmark.theme });
    }

    candidates.sort((a, b) => a.rank - b.rank);
    const maxDecorations = Math.min(420, Math.max(78, Math.floor(cols * rows * .065)));
    decorations = candidates.slice(0, maxDecorations);
  }

  function drawMapMarks(time) {
    for (const mark of mapMarks) {
      const p = screenPoint(mark.x, mark.y);
      const w = tile * 1.72, h = tile * 1.58;
      if (p.x < -w || p.y < -h || p.x > viewWidth + w || p.y > viewHeight + h) continue;
      const pulse = .94 + Math.sin(time * .0018 + mark.x * .7) * .035;
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y));
      ctx.globalAlpha = pulse;
      // An aged school plaque embedded into the ruin, not a HUD element.
      ctx.fillStyle = 'rgba(8,13,12,.84)';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(195,160,92,.66)';
      ctx.lineWidth = Math.max(1, tile * .035);
      ctx.strokeRect(-w / 2 + tile * .055, -h / 2 + tile * .055, w - tile * .11, h - tile * .11);
      ctx.strokeStyle = 'rgba(76,103,79,.75)';
      ctx.lineWidth = Math.max(1, tile * .025);
      ctx.strokeRect(-w / 2 + tile * .13, -h / 2 + tile * .13, w - tile * .26, h - tile * .26);
      if (schoolLogo.complete && schoolLogo.naturalWidth > 0) {
        const logoSize = tile * 1.02;
        ctx.globalAlpha = pulse * .97;
        ctx.drawImage(schoolLogo, -logoSize / 2, -logoSize * .61, logoSize, logoSize);
      } else {
        ctx.fillStyle = '#e4c866';
        ctx.font = `bold ${Math.max(7, tile * .34)}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CEF', 0, -tile * .12);
      }
      ctx.globalAlpha = pulse;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.max(6, tile * .235)}px monospace`;
      ctx.fillStyle = '#f0df9d';
      ctx.shadowColor = 'rgba(215,167,75,.72)'; ctx.shadowBlur = tile * .07;
      ctx.fillText('2 DS', 0, tile * .54);
      ctx.restore();
    }
  }

  function colorWithAlpha(color, alpha) {
    const hex = String(color || '#ffb45c').replace('#', '');
    const safe = hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex;
    const value = Number.parseInt(safe.slice(0, 6), 16);
    const r = Number.isFinite(value) ? (value >> 16) & 255 : 255;
    const g = Number.isFinite(value) ? (value >> 8) & 255 : 180;
    const b = Number.isFinite(value) ? value & 255 : 92;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function isOpenWorldCell(x, y) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (!(cy >= 0 && cy < rows && cx >= 0 && cx < cols && maze[cy] && maze[cy][cx] !== 1)) return false;
    return !secretDoors.some(door => !door.opened && door.x === cx && door.y === cy);
  }

  function traceProjectileLight(wx, wy, radiusTiles, rays = 28) {
    const points = [];
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2;
      let visible = radiusTiles;
      for (let distance = .10; distance <= radiusTiles; distance += .10) {
        if (!isOpenWorldCell(wx + Math.cos(angle) * distance, wy + Math.sin(angle) * distance)) {
          visible = Math.max(.025, distance - .10);
          break;
        }
      }
      points.push(screenPoint(wx + Math.cos(angle) * visible, wy + Math.sin(angle) * visible));
    }
    return points;
  }

  function tracePath(targetCtx, points) {
    if (!points.length) return;
    targetCtx.beginPath();
    targetCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) targetCtx.lineTo(points[i].x, points[i].y);
    targetCtx.closePath();
  }

  function prepareProjectileLights() {
    projectileLights = [...bullets, ...hostileBullets].map(b => {
      const radiusTiles = b.size > .06 ? 1.75 : 1.52;
      return {
        bullet: b,
        center: screenPoint(b.x, b.y),
        radius: tile * radiusTiles,
        boundary: traceProjectileLight(b.x, b.y, radiusTiles),
        color: b.color || '#ffb45c'
      };
    });
  }

  function drawProjectileGlows(time) {
    for (const light of projectileLights) {
      const { center: p, radius, boundary, color } = light;
      if (p.x < -radius || p.y < -radius || p.x > viewWidth + radius || p.y > viewHeight + radius) continue;
      ctx.save();
      tracePath(ctx, boundary); ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      const pulse = .92 + Math.sin(time * .06 + p.x) * .08;
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      glow.addColorStop(0, colorWithAlpha(color, .64 * pulse));
      glow.addColorStop(.16, colorWithAlpha(color, .36 * pulse));
      glow.addColorStop(.48, colorWithAlpha(color, .13));
      glow.addColorStop(1, colorWithAlpha(color, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
      ctx.restore();
    }
  }

  function drawBackground(time) {
    ctx.clearRect(0, 0, viewWidth, viewHeight);
    ctx.fillStyle = '#020302'; ctx.fillRect(0, 0, viewWidth, viewHeight);
    for (let i = 0; i < 42; i++) {
      const x = noiseAt(i, 3) * viewWidth;
      const y = (noiseAt(i, 9) * viewHeight + (time * .004 * (1 + (i % 3))) % viewHeight) % viewHeight;
      ctx.fillStyle = i % 4 === 0 ? 'rgba(216,139,68,.24)' : 'rgba(156,135,111,.10)';
      ctx.fillRect(Math.floor(x), Math.floor(y), i % 5 === 0 ? 2 : 1, 1);
    }
  }

  function drawFloorTile(px, py, x, y, theme = 0, time = 0) {
    const n = noiseAt(x, y, 11);
    const gap = Math.max(1, Math.floor(tile * .045));
    const half = tile / 2;
    // Dark mortar plus irregular inset stone blocks gives the floor a real cobblestone read.
    ctx.fillStyle = '#191b18';
    ctx.fillRect(px, py, tile, tile);
    const palette = ['#383b35', '#40433c', '#30332e', '#484a43', '#343831', '#3b3e38'];
    for (let sy = 0; sy < 2; sy++) {
      for (let sx = 0; sx < 2; sx++) {
        const v = noiseAt(x * 2 + sx, y * 2 + sy, 71);
        const inset = Math.max(1, Math.floor(tile * (.035 + v * .025)));
        const bx = px + sx * half + gap + (sy && v > .65 ? gap * .25 : 0);
        const by = py + sy * half + gap;
        const bw = half - gap * 1.55 - (sy && v > .65 ? gap * .25 : 0);
        const bh = half - gap * 1.55;
        const cut = Math.max(1, Math.floor(tile * (.035 + v * .025)));
        ctx.beginPath();
        ctx.moveTo(bx + cut, by);
        ctx.lineTo(bx + bw - cut, by);
        ctx.lineTo(bx + bw, by + cut);
        ctx.lineTo(bx + bw, by + bh - cut);
        ctx.lineTo(bx + bw - cut, by + bh);
        ctx.lineTo(bx + cut, by + bh);
        ctx.lineTo(bx, by + bh - cut);
        ctx.lineTo(bx, by + cut);
        ctx.closePath();
        ctx.fillStyle = palette[Math.floor(v * palette.length) % palette.length];
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.34)';
        ctx.lineWidth = Math.max(1, tile * .025);
        ctx.stroke();
        ctx.fillStyle = 'rgba(214,214,194,.09)';
        ctx.fillRect(bx + cut, by + cut * .35, Math.max(1, bw - cut * 2), Math.max(1, tile * .025));
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.fillRect(bx + bw - Math.max(1, tile * .035), by + cut, Math.max(1, tile * .035), Math.max(1, bh - cut * 1.5));

        // Chips and hairline cracks in a small number of stones.
        const chip = noiseAt(x * 2 + sx, y * 2 + sy, 83);
        if (chip > .79) {
          ctx.fillStyle = 'rgba(15,17,14,.55)';
          ctx.fillRect(bx + bw * (.22 + v * .3), by + bh * .28, Math.max(1, tile * .035), Math.max(1, tile * .17));
          ctx.fillRect(bx + bw * (.22 + v * .3), by + bh * .42, Math.max(1, tile * .11), Math.max(1, tile * .035));
        }
        if (chip < .13) {
          ctx.fillStyle = 'rgba(122,139,93,.25)';
          ctx.fillRect(bx + bw * .2, by + bh * .72, Math.max(1, tile * .12), Math.max(1, tile * .035));
          ctx.fillRect(bx + bw * .28, by + bh * .65, Math.max(1, tile * .035), Math.max(1, tile * .11));
        }
      }
    }

    // Occasional damp stains, mineral flecks, and tiny moss seams.
    const surface = noiseAt(x, y, 19);
    if (surface > .77) {
      ctx.fillStyle = 'rgba(13,48,42,.28)';
      ctx.fillRect(px + tile * .13, py + tile * .66, tile * (.20 + surface * .12), Math.max(1, tile * .07));
      ctx.fillStyle = 'rgba(83,125,76,.33)';
      ctx.fillRect(px + tile * .22, py + tile * .69, tile * .12, Math.max(1, tile * .035));
    }
    if (surface < .18) {
      ctx.fillStyle = 'rgba(108,39,27,.18)';
      ctx.fillRect(px + tile * .60, py + tile * .18, tile * .12, tile * .06);
      ctx.fillRect(px + tile * .55, py + tile * .23, tile * .06, tile * .05);
    }
    if (n > .88) {
      ctx.fillStyle = 'rgba(190,195,174,.23)';
      ctx.fillRect(px + tile * .23, py + tile * .26, Math.max(1, tile * .055), Math.max(1, tile * .055));
      ctx.fillRect(px + tile * .70, py + tile * .70, Math.max(1, tile * .04), Math.max(1, tile * .04));
    }
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.fillRect(px, py + tile - Math.max(1, tile * .035), tile, Math.max(1, tile * .035));

    // Theme-specific floor layers: shallow water, ruined chapel mosaic, or
    // damp earth with bioluminescent fungal growth.
    if (theme === 2) {
      ctx.fillStyle = 'rgba(24,76,91,.30)';
      ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2);
      const ripple = noiseAt(x, y, 63);
      if (ripple > .48) {
        const drift = Math.sin(time * .0012 + x * .9 + y * .5) * tile * .025;
        ctx.strokeStyle = `rgba(117,190,193,${.16 + ripple * .13})`;
        ctx.lineWidth = Math.max(1, tile * .025);
        ctx.beginPath();
        ctx.ellipse(px + tile * (.43 + drift / tile), py + tile * (.54 - drift / tile), tile * (.16 + ripple * .08), tile * (.07 + ripple * .035), -.12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(175,219,210,.25)';
        ctx.fillRect(px + tile * (.28 + ripple * .09), py + tile * .36, Math.max(1,tile*.07), Math.max(1,tile*.025));
      }
    } else if (theme === 3) {
      ctx.fillStyle = 'rgba(113,81,45,.13)'; ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2);
      ctx.strokeStyle = 'rgba(180,145,82,.19)'; ctx.lineWidth = Math.max(1, tile * .025);
      ctx.strokeRect(px + tile*.13, py + tile*.13, tile*.74, tile*.74);
      if (noiseAt(x, y, 64) > .90) {
        const c = tile * .045;
        ctx.fillStyle = 'rgba(186,151,91,.24)';
        ctx.fillRect(px + tile*.48, py + tile*.30, c, tile*.40);
        ctx.fillRect(px + tile*.34, py + tile*.42, tile*.32, c);
      }
    } else if (theme === 4) {
      ctx.fillStyle = 'rgba(21,75,44,.26)'; ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2);
      const glow = noiseAt(x, y, 67);
      if (glow > .72) {
        ctx.save();
        ctx.globalAlpha = .30 + Math.sin(time*.002 + glow*7)*.10;
        ctx.shadowColor = '#54d99a'; ctx.shadowBlur = tile*.15;
        ctx.fillStyle = glow > .88 ? '#76e0a2' : '#2b9d69';
        ctx.fillRect(px + tile*(.19 + glow*.24), py + tile*(.30 + (1-glow)*.2), Math.max(1,tile*.075), Math.max(1,tile*.055));
        ctx.fillRect(px + tile*(.61 - glow*.15), py + tile*.69, Math.max(1,tile*.045), Math.max(1,tile*.045));
        ctx.restore();
      }
    }
  }

  function themedWallAt(x, y) {
    const counts = new Map();
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const cell = maze[y+dy]?.[x+dx];
      if (cell >= 2 && cell <= 4) counts.set(cell, (counts.get(cell) || 0) + 1);
    }
    let result = 0, max = 0;
    for (const [theme,count] of counts) if (count > max) { result = theme; max = count; }
    return result;
  }

  function drawWallTile(px, py, x, y, time = 0, theme = 0) {
    const n = noiseAt(x, y, 5), gap = Math.max(1, Math.floor(tile * .055));
    ctx.fillStyle = '#10110f'; ctx.fillRect(px, py, tile, tile);
    const wallTone = n > .6 ? '#65665e' : n > .3 ? '#51534b' : '#42443d';
    ctx.fillStyle = wallTone;
    ctx.fillRect(px + gap, py + gap, tile - gap * 2, tile - gap * 2);
    ctx.fillStyle = 'rgba(224,222,201,.20)';
    ctx.fillRect(px + gap, py + gap, tile - gap * 2, Math.max(1, tile * .09));
    ctx.fillRect(px + gap, py + gap, Math.max(1, tile * .07), tile - gap * 2);
    ctx.fillStyle = 'rgba(0,0,0,.43)'; ctx.fillRect(px + gap, py + tile * .52, tile - gap * 2, Math.max(1, tile * .065));
    if ((x + y) % 2 === 0) ctx.fillRect(px + tile * .34, py + gap, Math.max(1, tile * .055), tile * .50);
    else ctx.fillRect(px + tile * .69, py + tile * .52, Math.max(1, tile * .055), tile * .43);

    if (n < .28 && tile > 13) {
      ctx.fillStyle = 'rgba(0,0,0,.58)';
      ctx.fillRect(px + tile * .48, py + tile * .17, Math.max(1, tile * .055), tile * .18);
      ctx.fillRect(px + tile * .4, py + tile * .34, tile * .14, Math.max(1, tile * .05));
      ctx.fillRect(px + tile * .38, py + tile * .34, Math.max(1, tile * .05), tile * .16);
    }

    // Mossy seams and little fern pixels break up the grid of stone.
    if (n > .60) {
      const mx = px + tile * (n > .82 ? .14 : .62), my = py + tile * (n > .82 ? .68 : .76);
      ctx.fillStyle = '#173e2d'; ctx.fillRect(mx, my, tile * .29, tile * .13);
      ctx.fillStyle = '#2d6947'; ctx.fillRect(mx + tile * .04, my - tile * .07, tile * .15, tile * .11);
      ctx.fillStyle = '#6f995c'; ctx.fillRect(mx + tile * .14, my + tile * .015, tile * .09, tile * .045);
      if (n > .81) {
        ctx.fillStyle = '#244d37';
        ctx.fillRect(px + tile * .72, py + tile * .17, Math.max(1, tile * .055), tile * .25);
        ctx.fillRect(px + tile * .65, py + tile * .32, tile * .10, Math.max(1, tile * .055));
        ctx.fillRect(px + tile * .73, py + tile * .39, tile * .09, Math.max(1, tile * .05));
        ctx.fillStyle = '#53834f'; ctx.fillRect(px + tile * .68, py + tile * .36, tile * .055, tile * .09);
      }
    }
    if (n > .76) {
      ctx.fillStyle = 'rgba(98,131,67,.31)';
      ctx.fillRect(px + tile * .14, py + tile * .68, tile * .2, Math.max(1, tile * .06));
    }

    // Swaying hanging roots and dangling vines give walls a little movement.
    if (noiseAt(x, y, 24) > .81) {
      const sway = Math.sin(time * .0016 + x * .75 + y * .33) * tile * .035;
      ctx.strokeStyle = '#244e35'; ctx.lineWidth = Math.max(1, tile * .045); ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(px + tile * .27, py + tile * .06);
      ctx.lineTo(px + tile * .29 + sway, py + tile * .30);
      ctx.lineTo(px + tile * .24 + sway * 1.5, py + tile * .47);
      ctx.stroke();
      ctx.fillStyle = '#4d8050';
      ctx.fillRect(px + tile * .29 + sway, py + tile * .27, Math.max(1, tile * .075), Math.max(1, tile * .045));
      ctx.fillRect(px + tile * .19 + sway * 1.5, py + tile * .43, Math.max(1, tile * .07), Math.max(1, tile * .04));
    }

    // Rare mineral chips make old stones catch the torchlight.
    if (noiseAt(x, y, 31) > .94) {
      ctx.fillStyle = 'rgba(105,177,139,.55)';
      ctx.fillRect(px + tile * .58, py + tile * .30, Math.max(1, tile * .055), Math.max(1, tile * .055));
      ctx.fillStyle = 'rgba(187,218,167,.48)';
      ctx.fillRect(px + tile * .64, py + tile * .35, Math.max(1, tile * .035), Math.max(1, tile * .035));
    }

    if (theme === 2) {
      ctx.fillStyle = 'rgba(28,95,104,.52)';
      ctx.fillRect(px + gap, py + tile*.68, tile-gap*2, tile*.12);
      ctx.fillStyle = 'rgba(93,160,159,.48)';
      ctx.fillRect(px + tile*.13, py + tile*.73, tile*.20, Math.max(1,tile*.035));
      if (noiseAt(x,y,84) > .70) { ctx.fillStyle = '#2d6659'; ctx.fillRect(px+tile*.68,py+tile*.59,tile*.09,tile*.21); }
    } else if (theme === 3) {
      ctx.fillStyle = 'rgba(166,126,66,.24)';
      ctx.fillRect(px + tile*.12, py + tile*.13, tile*.76, Math.max(1,tile*.035));
      if (noiseAt(x,y,85) > .73) {
        ctx.fillStyle = 'rgba(180,145,88,.30)';
        ctx.fillRect(px+tile*.46,py+tile*.22,tile*.08,tile*.18);
        ctx.fillRect(px+tile*.36,py+tile*.29,tile*.28,Math.max(1,tile*.045));
      }
    } else if (theme === 4) {
      const growth = noiseAt(x,y,86);
      if (growth > .28) {
        const pulse = .62 + Math.sin(time*.002 + x + y)*.18;
        ctx.save(); ctx.globalAlpha = pulse;
        ctx.shadowColor = '#42c982'; ctx.shadowBlur = tile*.13;
        ctx.fillStyle = '#236544'; ctx.fillRect(px+tile*.12,py+tile*.67,tile*.26,tile*.13);
        ctx.fillStyle = '#66ce8a'; ctx.fillRect(px+tile*.19,py+tile*.63,tile*.10,tile*.08);
        ctx.fillStyle = '#a1e6a0'; ctx.fillRect(px+tile*.22,py+tile*.64,Math.max(1,tile*.035),Math.max(1,tile*.035));
        ctx.restore();
      }
    }

    ctx.fillStyle = 'rgba(0,0,0,.52)';
    ctx.fillRect(px, py + tile - gap, tile, gap); ctx.fillRect(px + tile - gap, py, gap, tile);
  }

  function drawMaze(time) {
    const minX = clamp(Math.floor(-offsetX / tile), 0, cols - 1);
    const maxX = clamp(Math.ceil((viewWidth - offsetX) / tile), 0, cols - 1);
    const minY = clamp(Math.floor(-offsetY / tile), 0, rows - 1);
    const maxY = clamp(Math.ceil((viewHeight - offsetY) / tile), 0, rows - 1);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = Math.floor(offsetX + x * tile), py = Math.floor(offsetY + y * tile);
      if (maze[y][x] === 1) drawWallTile(px, py, x, y, time, themedWallAt(x, y)); else drawFloorTile(px, py, x, y, maze[y][x] >= 2 ? maze[y][x] : 0, time);
    }
  }

  function drawDecorations(time) {
    for (const deco of decorations) {
      const p = screenPoint(deco.x + .5, deco.y + .5), x = Math.round(p.x), y = Math.round(p.y), t = tile;
      if (x < -t || y < -t || x > viewWidth + t || y > viewHeight + t) continue;
      const pulse = .8 + Math.sin(time * .003 + deco.phase) * .10;
      ctx.save(); ctx.translate(x, y);
      switch (deco.type) {
        case 'sarcophagus': {
          ctx.fillStyle = 'rgba(0,0,0,.48)'; ctx.fillRect(-t*.40,t*.28,t*.82,t*.12);
          ctx.fillStyle = '#252e2d'; ctx.fillRect(-t*.34,-t*.39,t*.68,t*.82);
          ctx.fillStyle = '#626a61'; ctx.fillRect(-t*.31,-t*.37,t*.62,t*.75);
          ctx.fillStyle = '#8b9080'; ctx.fillRect(-t*.28,-t*.34,t*.56,t*.08);
          ctx.fillStyle = '#3d4742'; ctx.fillRect(-t*.25,-t*.22,t*.50,t*.47);
          ctx.fillStyle = '#a5a28a'; ctx.fillRect(-t*.035,-t*.19,t*.07,t*.31); ctx.fillRect(-t*.13,-t*.10,t*.26,t*.06);
          ctx.fillStyle = '#303a35'; ctx.fillRect(-t*.28,t*.34,t*.56,t*.055);
          break;
        }
        case 'altar': {
          ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-t*.42,t*.24,t*.84,t*.14);
          ctx.fillStyle = '#383a35'; ctx.fillRect(-t*.38,-t*.26,t*.76,t*.52);
          ctx.fillStyle = '#888576'; ctx.fillRect(-t*.40,-t*.29,t*.80,t*.10);
          ctx.fillStyle = '#5f5b4b'; ctx.fillRect(-t*.31,-t*.16,t*.62,t*.33);
          ctx.fillStyle = '#b5a16f'; ctx.fillRect(-t*.035,-t*.14,t*.07,t*.27); ctx.fillRect(-t*.14,-t*.06,t*.28,t*.055);
          ctx.fillStyle = '#d6a55c'; ctx.shadowColor = '#e2a44e'; ctx.shadowBlur = t*.18;
          ctx.fillRect(-t*.18,-t*.38,t*.10,t*.10); ctx.fillRect(t*.09,-t*.38,t*.10,t*.10); ctx.shadowBlur = 0;
          break;
        }
        case 'fungus-heart': {
          ctx.fillStyle = 'rgba(0,0,0,.48)'; ctx.fillRect(-t*.42,t*.28,t*.84,t*.12);
          ctx.save(); ctx.globalAlpha = .5 + Math.sin(time*.003 + deco.phase)*.18;
          ctx.shadowColor = '#4fe8a0'; ctx.shadowBlur = t*.35;
          ctx.fillStyle = '#2b7454'; ctx.fillRect(-t*.28,-t*.02,t*.12,t*.30); ctx.fillRect(-t*.02,-t*.16,t*.11,t*.43); ctx.fillRect(t*.18,-t*.04,t*.11,t*.32);
          ctx.fillStyle = '#47a979'; ctx.fillRect(-t*.38,-t*.12,t*.30,t*.16); ctx.fillRect(-t*.12,-t*.29,t*.31,t*.17); ctx.fillRect(t*.10,-t*.17,t*.29,t*.15);
          ctx.fillStyle = '#9cf0a4'; ctx.fillRect(-t*.30,-t*.13,t*.13,t*.045); ctx.fillRect(-t*.04,-t*.30,t*.15,t*.045); ctx.fillRect(t*.17,-t*.18,t*.13,t*.04);
          ctx.fillStyle = '#d3f7bc'; ctx.fillRect(-t*.23,t*.12,Math.max(1,t*.035),Math.max(1,t*.035)); ctx.fillRect(t*.05,t*.04,Math.max(1,t*.03),Math.max(1,t*.03));
          ctx.restore();
          break;
        }
        case 'water-ripple': {
          const ripple = .5 + Math.sin(time*.002 + deco.phase)*.5;
          ctx.fillStyle = 'rgba(4,19,24,.46)'; ctx.fillRect(-t*.40,-t*.20,t*.80,t*.43);
          ctx.strokeStyle = `rgba(107,184,191,${.25 + ripple*.25})`; ctx.lineWidth = Math.max(1,t*.025);
          ctx.beginPath(); ctx.ellipse(-t*.02,t*.015,t*(.14+ripple*.10),t*(.045+ripple*.045),-.10,0,Math.PI*2); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(-t*.02,t*.015,t*(.27+ripple*.06),t*(.09+ripple*.03),-.10,0,Math.PI*2); ctx.stroke();
          ctx.fillStyle = 'rgba(190,224,215,.52)'; ctx.fillRect(-t*.23,-t*.12,t*.13,Math.max(1,t*.025));
          break;
        }
        case 'submerged-rubble': {
          ctx.fillStyle = 'rgba(0,0,0,.40)'; ctx.fillRect(-t*.34,t*.16,t*.68,t*.10);
          ctx.fillStyle = '#3d5754'; ctx.fillRect(-t*.32,-t*.10,t*.26,t*.24); ctx.fillRect(t*.02,-t*.19,t*.25,t*.22);
          ctx.fillStyle = '#67756b'; ctx.fillRect(-t*.28,-t*.13,t*.17,t*.06); ctx.fillRect(t*.07,-t*.22,t*.15,t*.055);
          ctx.fillStyle = '#46766d'; ctx.fillRect(-t*.20,t*.08,t*.36,Math.max(1,t*.035));
          break;
        }
        case 'seaweed': {
          const sway = Math.sin(time*.002 + deco.phase)*t*.07;
          ctx.fillStyle = 'rgba(0,0,0,.33)'; ctx.fillRect(-t*.23,t*.17,t*.46,t*.08);
          ctx.strokeStyle = '#2a7058'; ctx.lineWidth = Math.max(1.4,t*.055); ctx.lineCap = 'square';
          ctx.beginPath(); ctx.moveTo(-t*.12,t*.17); ctx.lineTo(-t*.16+sway,-t*.05); ctx.lineTo(-t*.25+sway,-t*.25); ctx.moveTo(0,t*.17); ctx.lineTo(t*.03-sway*.5,-t*.13); ctx.lineTo(t*.15-sway,-t*.31); ctx.moveTo(t*.11,t*.17); ctx.lineTo(t*.18+sway,-t*.02); ctx.stroke();
          ctx.fillStyle = '#54956a'; ctx.fillRect(-t*.24+sway,-t*.27,t*.12,t*.07); ctx.fillRect(t*.09-sway,-t*.33,t*.12,t*.07);
          break;
        }
        case 'broken-pillar': {
          ctx.fillStyle = 'rgba(0,0,0,.44)'; ctx.fillRect(-t*.34,t*.24,t*.68,t*.14);
          ctx.fillStyle = '#383a34'; ctx.fillRect(-t*.29,-t*.27,t*.58,t*.56);
          ctx.fillStyle = '#797b6d'; ctx.fillRect(-t*.25,-t*.26,t*.50,t*.10); ctx.fillRect(-t*.25,t*.15,t*.50,t*.09);
          ctx.fillStyle = '#50534a'; ctx.fillRect(-t*.18,-t*.14,t*.36,t*.27);
          ctx.fillStyle = '#979681'; ctx.fillRect(-t*.16,-t*.12,t*.12,t*.045); ctx.fillRect(t*.08,t*.05,t*.09,t*.04);
          break;
        }
        case 'pew': {
          ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fillRect(-t*.40,t*.20,t*.80,t*.10);
          ctx.fillStyle = '#30251a'; ctx.fillRect(-t*.37,-t*.14,t*.74,t*.10); ctx.fillRect(-t*.34,t*.02,t*.68,t*.09);
          ctx.fillStyle = '#77583a'; ctx.fillRect(-t*.36,-t*.17,t*.72,t*.06); ctx.fillRect(-t*.33,t*.00,t*.66,t*.05);
          ctx.fillStyle = '#4b3926'; ctx.fillRect(-t*.29,t*.07,t*.07,t*.16); ctx.fillRect(t*.22,t*.07,t*.07,t*.16);
          break;
        }
        case 'chapel-candle': {
          const flicker = .80 + Math.sin(time*.018 + deco.phase)*.20;
          ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fillRect(-t*.22,t*.17,t*.44,t*.07);
          ctx.fillStyle = '#716148'; ctx.fillRect(-t*.19,t*.08,t*.38,t*.08);
          ctx.fillStyle = '#c3b58e'; ctx.fillRect(-t*.09,-t*.20,t*.18,t*.29);
          ctx.fillStyle = '#6a5036'; ctx.fillRect(-t*.035,-t*.23,t*.07,t*.06);
          ctx.save(); ctx.globalAlpha = flicker; ctx.shadowColor = '#ffb34f'; ctx.shadowBlur = t*.28;
          ctx.fillStyle = '#f39a36'; ctx.fillRect(-t*.055,-t*.34,t*.11,t*.13);
          ctx.fillStyle = '#fff0b0'; ctx.fillRect(-t*.025,-t*.30,t*.05,t*.07); ctx.restore();
          break;
        }
        case 'glow-spores': {
          const pulse = .55 + Math.sin(time*.002 + deco.phase)*.4;
          ctx.save(); ctx.globalAlpha = pulse; ctx.shadowColor = '#77e7a0'; ctx.shadowBlur = t*.12;
          ctx.fillStyle = '#b4f2a8'; ctx.fillRect(-t*.25,-t*.12,Math.max(1,t*.07),Math.max(1,t*.07));
          ctx.fillRect(t*.12,t*.02,Math.max(1,t*.045),Math.max(1,t*.045));
          ctx.fillRect(t*.01,-t*.26,Math.max(1,t*.04),Math.max(1,t*.04)); ctx.restore();
          break;
        }
        case 'roots': {
          const sway = Math.sin(time*.0015 + deco.phase)*t*.035;
          ctx.strokeStyle = '#315f3b'; ctx.lineWidth = Math.max(1.2,t*.055);
          ctx.beginPath(); ctx.moveTo(-t*.28,-t*.24); ctx.lineTo(-t*.04+sway,-t*.02); ctx.lineTo(-t*.22+sway,t*.20); ctx.moveTo(t*.21,-t*.26); ctx.lineTo(t*.06-sway,t*.03); ctx.lineTo(t*.28-sway,t*.19); ctx.stroke();
          ctx.fillStyle = '#61945b'; ctx.fillRect(-t*.25+sway,t*.07,t*.10,t*.055); ctx.fillRect(t*.17-sway,t*.08,t*.09,t*.05);
          break;
        }
        case 'rubble': {
          ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.fillRect(-t*.28, t*.13, t*.60, t*.12);
          ctx.fillStyle = '#55584f'; ctx.fillRect(-t*.27, -t*.06, t*.20, t*.17);
          ctx.fillStyle = '#74766a'; ctx.fillRect(-t*.24, -t*.07, t*.12, t*.045);
          ctx.fillStyle = '#353a32'; ctx.fillRect(t*.04, t*.015, t*.23, t*.16);
          ctx.fillStyle = '#62665a'; ctx.fillRect(t*.10, -t*.025, t*.12, t*.05);
          ctx.fillStyle = '#282c25'; ctx.fillRect(-t*.02, t*.10, t*.08, t*.04);
          break;
        }
        case 'debris': {
          ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(-t*.30, t*.11, t*.62, t*.09);
          ctx.fillStyle = '#443626'; ctx.fillRect(-t*.28, -t*.06, t*.49, t*.09);
          ctx.fillStyle = '#7a6240'; ctx.fillRect(-t*.25, -t*.08, t*.43, Math.max(1, t*.025));
          ctx.fillStyle = '#31271c'; ctx.fillRect(-t*.16, t*.02, t*.24, t*.055);
          ctx.fillStyle = '#5a4a32'; ctx.fillRect(t*.13, -t*.14, t*.055, t*.23);
          break;
        }
        case 'bones': {
          ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fillRect(-t*.29, t*.12, t*.58, t*.08);
          ctx.strokeStyle = '#a49a7e'; ctx.lineWidth = Math.max(1.4, t*.055); ctx.lineCap = 'square';
          ctx.beginPath(); ctx.moveTo(-t*.22, -t*.10); ctx.lineTo(t*.20, t*.08); ctx.moveTo(-t*.12, t*.11); ctx.lineTo(t*.18, -t*.10); ctx.stroke();
          ctx.fillStyle = '#c0b69a'; ctx.fillRect(-t*.27, -t*.15, t*.08, t*.08); ctx.fillRect(-t*.22, -t*.18, t*.08, t*.07);
          ctx.fillRect(t*.15, t*.035, t*.08, t*.075); ctx.fillRect(t*.17, t*.08, t*.08, t*.07);
          ctx.fillStyle = '#3a352b'; ctx.fillRect(-t*.24, -t*.12, t*.025, t*.025); ctx.fillRect(-t*.18, -t*.12, t*.025, t*.025);
          break;
        }
        case 'puddle': {
          const shimmer = .5 + Math.sin(time * .0023 + deco.phase) * .22;
          ctx.fillStyle = 'rgba(0,0,0,.36)'; ctx.fillRect(-t*.34, -t*.04, t*.72, t*.28);
          ctx.fillStyle = 'rgba(17,48,50,.76)'; ctx.fillRect(-t*.31, -t*.11, t*.60, t*.23);
          ctx.fillStyle = 'rgba(49,91,86,.42)'; ctx.fillRect(-t*.24, -t*.08, t*.45, t*.14);
          ctx.fillStyle = `rgba(159,195,167,${.12 + shimmer*.18})`; ctx.fillRect(-t*.18, -t*.055, t*.23, Math.max(1,t*.025));
          ctx.fillStyle = `rgba(115,171,157,${.08 + shimmer*.14})`; ctx.fillRect(t*.08, t*.015, t*.13, Math.max(1,t*.025));
          break;
        }
        case 'stain': {
          ctx.fillStyle = 'rgba(34,17,16,.55)';
          ctx.fillRect(-t*.25, -t*.08, t*.35, t*.16); ctx.fillRect(-t*.11, -t*.15, t*.28, t*.12);
          ctx.fillRect(t*.12, t*.02, t*.16, t*.08); ctx.fillRect(-t*.31, t*.02, t*.11, t*.06);
          ctx.fillStyle = 'rgba(94,37,29,.22)'; ctx.fillRect(-t*.12, -t*.03, t*.26, t*.07);
          break;
        }
        case 'fungus': {
          ctx.globalAlpha = pulse;
          ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-t*.28, t*.12, t*.56, t*.10);
          ctx.fillStyle = '#88a994'; ctx.fillRect(-t*.17, -t*.03, t*.055, t*.18); ctx.fillRect(t*.06, -t*.06, t*.055, t*.21);
          ctx.fillStyle = '#277a64'; ctx.fillRect(-t*.24, -t*.09, t*.19, t*.10); ctx.fillRect(-t*.27, -t*.07, t*.11, t*.065);
          ctx.fillStyle = '#61bf92'; ctx.fillRect(-t*.22, -t*.10, t*.14, Math.max(1,t*.035));
          ctx.fillStyle = '#2b8f78'; ctx.fillRect(t*.00, -t*.14, t*.18, t*.10);
          ctx.fillStyle = '#a1e0a9'; ctx.fillRect(t*.035, -t*.15, t*.09, Math.max(1,t*.035));
          ctx.fillStyle = '#d1edb1'; ctx.fillRect(-t*.11, t*.06, Math.max(1,t*.035), Math.max(1,t*.035));
          break;
        }
        case 'lantern': {
          const flicker = .85 + Math.sin(time * .017 + deco.phase) * .15;
          ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fillRect(-t*.20, t*.15, t*.44, t*.09);
          ctx.fillStyle = '#30271b'; ctx.fillRect(-t*.12, -t*.22, t*.25, t*.36);
          ctx.fillStyle = '#987648'; ctx.fillRect(-t*.15, -t*.25, t*.31, t*.045);
          ctx.fillRect(-t*.15, t*.10, t*.31, t*.045);
          ctx.fillStyle = '#9a612d'; ctx.fillRect(-t*.10, -t*.17, t*.21, t*.22);
          ctx.fillStyle = `rgba(255,142,55,${flicker})`; ctx.fillRect(-t*.07, -t*.13, t*.15, t*.14);
          ctx.fillStyle = '#ffe29a'; ctx.fillRect(-t*.025, -t*.11, t*.06, t*.095);
          ctx.fillStyle = '#34281a'; ctx.fillRect(-t*.18, -t*.29, t*.36, t*.045);
          break;
        }
      }
      ctx.restore();
    }
  }

  function drawSecretDoors(time) {
    for (const door of secretDoors) {
      const p = screenPoint(door.x + .5, door.y + .5), x = Math.round(p.x), y = Math.round(p.y);
      if (x < -tile || y < -tile || x > viewWidth+tile || y > viewHeight+tile) continue;
      ctx.save();
      if (door.opened) {
        ctx.fillStyle = '#17140f'; ctx.fillRect(x-tile*.46,y-tile*.46,tile*.92,tile*.92);
        ctx.fillStyle = '#675039'; ctx.fillRect(x-tile*.47,y-tile*.47,tile*.12,tile*.95); ctx.fillRect(x+tile*.35,y-tile*.47,tile*.12,tile*.95);
      } else {
        ctx.fillStyle = '#292a25'; ctx.fillRect(x-tile*.48,y-tile*.48,tile*.96,tile*.96);
        ctx.fillStyle = '#42433a'; ctx.fillRect(x-tile*.44,y-tile*.42,tile*.88,tile*.16); ctx.fillRect(x-tile*.44,y-tile*.08,tile*.88,tile*.15); ctx.fillRect(x-tile*.44,y+tile*.25,tile*.88,tile*.14);
        ctx.fillStyle = '#191a16'; ctx.fillRect(x-tile*.10,y-tile*.48,tile*.06,tile*.96);
        ctx.fillStyle = '#9b8154'; ctx.fillRect(x+tile*.20,y+tile*.02,tile*.07,tile*.07);
        if (door.revealed || Math.sin(time*.004+door.id)> .94) { ctx.globalAlpha = .75; ctx.strokeStyle='#9fbe83'; ctx.lineWidth=Math.max(1,tile*.035); ctx.strokeRect(x-tile*.42,y-tile*.42,tile*.84,tile*.84); }
      }
      ctx.restore();
    }
  }

  function drawLootPickups(time) {
    for (const item of lootPickups) {
      if (item.taken) continue;
      const p=screenPoint(item.x+.5,item.y+.5); if(p.x < -tile || p.y < -tile || p.x > viewWidth+tile || p.y > viewHeight+tile) continue;
      const bob=reducedMotion?0:Math.sin(time*.003+item.phase)*tile*.035;
      const colors={key:'#f3d36f',health:'#db6d64',ammo:'#d9b16e',cache:'#c79a58'}; const c=colors[item.type]||'#d9b16e';
      ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y+bob));ctx.globalCompositeOperation='screen';ctx.globalAlpha=.28;ctx.fillStyle=c;ctx.shadowColor=c;ctx.shadowBlur=tile*.48;ctx.fillRect(-tile*.28,-tile*.28,tile*.56,tile*.56);ctx.restore();
      ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y+bob));ctx.shadowColor=c;ctx.shadowBlur=tile*.22;
      if(item.type==='key') { ctx.strokeStyle='#ffe6a1';ctx.lineWidth=Math.max(2,tile*.08);ctx.beginPath();ctx.arc(-tile*.09,-tile*.05,tile*.13,0,Math.PI*2);ctx.stroke();ctx.fillStyle=c;ctx.fillRect(tile*.01,-tile*.015,tile*.27,tile*.07);ctx.fillRect(tile*.19,tile*.03,tile*.06,tile*.13);ctx.fillRect(tile*.27,tile*.03,tile*.05,tile*.09); }
      else if(item.type==='health') { ctx.fillStyle='#642d29';ctx.fillRect(-tile*.25,-tile*.20,tile*.5,tile*.4);ctx.fillStyle='#f2ded0';ctx.fillRect(-tile*.17,-tile*.13,tile*.34,tile*.26);ctx.fillStyle='#cf5549';ctx.fillRect(-tile*.055,-tile*.10,tile*.11,tile*.20);ctx.fillRect(-tile*.13,-tile*.055,tile*.26,tile*.11); }
      else if(item.type==='ammo') { ctx.fillStyle='#57432e';ctx.fillRect(-tile*.26,-tile*.19,tile*.52,tile*.38);ctx.fillStyle='#d7b477';ctx.fillRect(-tile*.18,-tile*.1,tile*.1,tile*.21);ctx.fillRect(-tile*.04,-tile*.1,tile*.1,tile*.21);ctx.fillRect(tile*.10,-tile*.1,tile*.1,tile*.21); }
      else { ctx.fillStyle='#493724';ctx.fillRect(-tile*.28,-tile*.18,tile*.56,tile*.4);ctx.fillStyle='#b98a4b';ctx.fillRect(-tile*.32,-tile*.23,tile*.64,tile*.10);ctx.fillStyle='#dabf7c';ctx.fillRect(-tile*.06,-tile*.15,tile*.12,tile*.28); }
      ctx.restore();
    }
  }

  function drawExit(time) {
    const { x: ex, y: ey } = screenPoint(exit.x + .5, exit.y + .5);
    if (ex < -tile || ey < -tile || ex > viewWidth + tile || ey > viewHeight + tile) return;
    const pulse = .5 + Math.sin(time * .0025) * .13, w = tile * .58, h = tile * .72;
    const gateColor = hasKey ? '#9ba96a' : '#9c5144';
    ctx.save(); ctx.globalAlpha = .35 + pulse * .3; ctx.fillStyle = gateColor; ctx.shadowColor = gateColor; ctx.shadowBlur = tile * .65;
    ctx.fillRect(ex - w * .5, ey - h * .5, w, h); ctx.restore();
    ctx.save(); ctx.shadowColor = gateColor; ctx.shadowBlur = tile * .32;
    ctx.fillStyle = hasKey ? '#3e4829' : '#43251f'; ctx.fillRect(ex - w*.5, ey - h*.5, w, h);
    ctx.fillStyle = gateColor; ctx.fillRect(ex - w*.5, ey - h*.5, w, Math.max(1,tile*.08));
    ctx.fillRect(ex - w*.5, ey - h*.5, Math.max(1,tile*.07), h); ctx.fillRect(ex + w*.5-Math.max(1,tile*.07), ey-h*.5, Math.max(1,tile*.07), h);
    ctx.fillStyle = '#0c1009'; ctx.fillRect(ex - w*.30, ey - h*.33, w*.60, h*.82);
    ctx.fillStyle = hasKey ? '#cadb82' : '#d28e61'; ctx.fillRect(ex + w*.12, ey + h*.04, Math.max(1,tile*.07), Math.max(1,tile*.07));
    if (!hasKey) { ctx.strokeStyle = '#d28e61'; ctx.lineWidth = Math.max(1,tile*.04); ctx.beginPath(); ctx.arc(ex,ey-h*.09,tile*.10,Math.PI,Math.PI*2); ctx.stroke(); } ctx.restore();
  }

  function drawEmbers(time) {
    for (const ember of coins) {
      if (ember.taken) continue;
      const p = screenPoint(ember.x + .5, ember.y + .5);
      if (p.x < -tile || p.y < -tile || p.x > viewWidth + tile || p.y > viewHeight + tile) continue;
      const bob = Math.sin(time * .004 + ember.phase) * tile * .055, s = Math.max(1.3, tile * .075);
      ctx.save(); ctx.translate(Math.floor(p.x), Math.floor(p.y + bob)); ctx.shadowColor = '#ff8d32'; ctx.shadowBlur = tile * .3;
      ctx.fillStyle = '#c46127'; ctx.fillRect(-s*1.8,-s*.2,s*3.6,s*1.8); ctx.fillRect(-s*.55,-s*2.1,s*1.1,s*2.1);
      ctx.fillStyle = '#ffd47c'; ctx.fillRect(-s*.55,-s*.9,s*1.1,s*1.8); ctx.restore();
    }
  }

  function drawWeaponPickups(time) {
    const colors = { pistol: '#f4cb78', shotgun: '#a5d3a1', ak: '#e48b58' };
    for (const pickup of weaponPickups) {
      if (pickup.taken) continue;
      const p = screenPoint(pickup.x + .5, pickup.y + .5);
      if (p.x < -tile || p.y < -tile || p.x > viewWidth + tile || p.y > viewHeight + tile) continue;
      const bob = Math.sin(time * .003 + pickup.phase) * tile * .04;
      const c = colors[pickup.id];
      const scale = tile * .48;
      ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y + bob));
      ctx.shadowColor = c; ctx.shadowBlur = tile * (.38 + Math.sin(time * .005 + pickup.phase) * .08);
      ctx.fillStyle = 'rgba(4,10,8,.88)'; ctx.fillRect(-scale * .68, -scale * .43, scale * 1.36, scale * .86);
      ctx.strokeStyle = c; ctx.globalAlpha = .82; ctx.lineWidth = Math.max(1, tile * .025);
      ctx.strokeRect(-scale * .68, -scale * .43, scale * 1.36, scale * .86);
      ctx.rotate(-.14);
      ctx.fillStyle = c;
      if (pickup.id === 'pistol') {
        ctx.fillRect(-scale*.26, -scale*.10, scale*.53, scale*.19);
        ctx.fillRect(-scale*.12, scale*.02, scale*.16, scale*.27);
        ctx.fillStyle = '#433b28'; ctx.fillRect(-scale*.03, scale*.02, scale*.12, scale*.17);
      } else if (pickup.id === 'shotgun') {
        ctx.fillRect(-scale*.48, -scale*.065, scale*.87, scale*.13);
        ctx.fillStyle = '#68523a'; ctx.fillRect(-scale*.48, -scale*.11, scale*.19, scale*.22);
        ctx.fillStyle = '#d7c69b'; ctx.fillRect(scale*.32, -scale*.045, scale*.17, scale*.09);
        ctx.fillStyle = '#5e4631'; ctx.fillRect(-scale*.08, scale*.01, scale*.13, scale*.18);
      } else {
        ctx.fillRect(-scale*.50, -scale*.07, scale*.92, scale*.14);
        ctx.fillStyle = '#6b5839'; ctx.fillRect(-scale*.49, -scale*.15, scale*.22, scale*.23);
        ctx.fillStyle = '#bc7542'; ctx.fillRect(scale*.15, scale*.035, scale*.19, scale*.20);
        ctx.fillStyle = '#ded0a2'; ctx.fillRect(scale*.39, -scale*.045, scale*.14, scale*.09);
      }
      ctx.restore();
    }
  }

  function drawPickupToast(time) {
    if (!pickupToast || time > pickupToastUntil) return;
    const fade = Math.min(1, (pickupToastUntil - time) / 320);
    ctx.save(); ctx.globalAlpha = fade; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.max(11, Math.min(15, tile * .42))}px monospace`;
    ctx.shadowColor = '#000'; ctx.shadowBlur = 8; ctx.fillStyle = '#d9e9c6';
    ctx.fillText(pickupToast, viewWidth / 2, viewHeight - Math.max(38, tile * 1.35));
    ctx.restore();
  }

  function drawObjectiveText() {
    if (!objectiveText) return;
    const label = `${hasKey ? '✦' : '◇'} ${objectiveText}`;
    ctx.save();ctx.font=`bold ${Math.max(10,Math.min(13,tile*.36))}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
    const width=Math.min(viewWidth-24,ctx.measureText(label).width+22), x=viewWidth/2, y=Math.max(23,tile*.72);
    ctx.fillStyle='rgba(7,10,8,.63)';ctx.fillRect(x-width/2,y-11,width,22);ctx.strokeStyle=hasKey?'rgba(171,204,132,.45)':'rgba(208,166,103,.36)';ctx.lineWidth=1;ctx.strokeRect(x-width/2,y-11,width,22);
    ctx.fillStyle=hasKey?'#d8e7b8':'#ddc49a';ctx.fillText(label,x,y+.5);ctx.restore();
  }

  function drawMiniMap(time) {
    const maxW=Math.min(252,viewWidth*.31), maxH=Math.min(190,viewHeight*.32);
    const scale=Math.max(.8,Math.min((maxW-16)/cols,(maxH-28)/rows));
    const mapW=cols*scale,mapH=rows*scale,x0=viewWidth-mapW-20,y0=18;
    ctx.save();ctx.fillStyle='rgba(4,8,6,.86)';ctx.fillRect(x0-8,y0-8,mapW+16,mapH+29);ctx.strokeStyle='rgba(167,190,138,.5)';ctx.lineWidth=1;ctx.strokeRect(x0-8,y0-8,mapW+16,mapH+29);
    ctx.font='9px monospace';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#cdd8b8';ctx.fillText('MAPA · M',x0,y0-1);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const v=maze[y][x];ctx.fillStyle=v===1?'#313832':v===2?'#355b60':v===3?'#63503f':v===4?'#314d3a':'#17221a';ctx.fillRect(x0+x*scale,y0+12+y*scale,Math.ceil(scale),Math.ceil(scale));
    }
    for(const door of secretDoors){if(!door.opened&&!door.revealed)continue;ctx.fillStyle=door.opened?'#71956d':'#cfb77a';ctx.fillRect(x0+door.x*scale,y0+12+door.y*scale,Math.max(2,scale*1.3),Math.max(2,scale*1.3));}
    for(const item of lootPickups)if(!item.taken&&(!item.secret||secretDoors.some(door=>door.id===item.secretId&&door.opened))){ctx.fillStyle=item.type==='key'?'#f6d578':item.type==='health'?'#e46d62':'#d9b16e';ctx.fillRect(x0+(item.x+.25)*scale,y0+12+(item.y+.25)*scale,Math.max(2,scale*1.5),Math.max(2,scale*1.5));}
    for(const e of enemies)if(e.alive){ctx.fillStyle=e.boss?'#ff704f':e.ranged?'#9ee1c1':'#d18d72';ctx.fillRect(x0+e.x*scale-1,y0+12+e.y*scale-1,Math.max(2,scale*1.5),Math.max(2,scale*1.5));}
    ctx.fillStyle=hasKey?'#bde6a0':'#a9ca8b';ctx.fillRect(x0+(exit.x+.5)*scale-1,y0+12+(exit.y+.5)*scale-1,Math.max(3,scale*2),Math.max(3,scale*2));
    ctx.fillStyle='#ffe3ab';ctx.beginPath();ctx.arc(x0+player.x*scale,y0+12+player.y*scale,Math.max(2,scale*1.5),0,Math.PI*2);ctx.fill();ctx.restore();
  }

  function pixelRect(x, y, w, h, color, s) {
    ctx.fillStyle = color; ctx.fillRect(Math.round(x*s), Math.round(y*s), Math.max(1,Math.round(w*s)), Math.max(1,Math.round(h*s)));
  }

  function drawPlayer(time) {
    const p = screenPoint(player.x, player.y), cx = p.x, cy = p.y, s = tile / 22;
    const bob = player.moving ? Math.sin(time * .028) * .5 : Math.sin(time * .009) * .18;
    ctx.save(); ctx.translate(Math.round(cx), Math.round(cy + bob*s));
    ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.beginPath(); ctx.ellipse(0, tile*.21, tile*.25, tile*.11, 0, 0, Math.PI*2); ctx.fill();
    pixelRect(-5,1,10,12,'#211912',s); pixelRect(-6,3,12,8,'#35271b',s);
    pixelRect(-4,11,3,4,'#15110d',s); pixelRect(2,11,3,4,'#15110d',s);
    pixelRect(-3,-5,6,7,'#73502d',s); pixelRect(-4,-7,8,4,'#37271b',s);
    pixelRect(-3,-9,6,4,'#80603b',s); pixelRect(-4,-10,8,2,'#171511',s);
    pixelRect(-2,-6,1,1,'#dcb77b',s); pixelRect(2,-6,1,1,'#dcb77b',s);
    // Torch carried in the direction of movement / aim.
    ctx.restore();
    ctx.save(); ctx.translate(cx + Math.cos(player.angle)*tile*.22, cy + Math.sin(player.angle)*tile*.22); ctx.rotate(player.angle);
    ctx.fillStyle = '#7b4727'; ctx.fillRect(0, -tile*.035, tile*.28, tile*.07);
    ctx.shadowColor = '#ff842c'; ctx.shadowBlur = tile*.38; ctx.fillStyle = '#e76024'; ctx.fillRect(tile*.21,-tile*.09,tile*.12,tile*.18);
    ctx.fillStyle = '#ffe18c'; ctx.fillRect(tile*.245,-tile*.055,tile*.055,tile*.11);
    ctx.fillStyle = '#fff0ba'; ctx.fillRect(tile*.275,-tile*.025,tile*.025,tile*.05); ctx.restore();
  }

  function drawSkeleton(enemy, time) {
    const p = screenPoint(enemy.x, enemy.y), x = p.x, y = p.y, s = tile / 18;
    if (x < -tile || y < -tile || x > viewWidth + tile || y > viewHeight + tile) return;
    const stride = Math.sin(enemy.stepPhase) * 1.2;
    const attacking = enemy.attackAnim > 0;
    const attackDuration = enemy.boss ? .78 : enemy.ranged ? .42 : .52;
    const attackProgress = attacking ? 1 - enemy.attackAnim / attackDuration : 0;
    const swing = attacking ? Math.sin(Math.min(1, attackProgress) * Math.PI) : 0;
    const lunge = attacking ? Math.sin(Math.min(1, attackProgress) * Math.PI) * tile * .075 : 0;
    const dirX = Math.cos(enemy.angle), dirY = Math.sin(enemy.angle);
    ctx.save(); ctx.translate(Math.round(x + dirX * lunge), Math.round(y + dirY * lunge));
    ctx.scale(enemy.scale || 1, enemy.scale || 1);
    if (enemy.boss) { ctx.globalAlpha=.5+Math.sin(time*.006)*.12;ctx.fillStyle='#5a201a';ctx.shadowColor='#b6372a';ctx.shadowBlur=tile*.5;ctx.beginPath();ctx.ellipse(0,0,tile*.39,tile*.46,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.shadowBlur=0; }
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.beginPath(); ctx.ellipse(0,tile*.22,tile*.27,tile*.1,0,0,Math.PI*2); ctx.fill();
    const bone = enemy.flash > 0 ? '#fff0d6' : (enemy.type === 'archer' ? '#a9c1a8' : enemy.type === 'runner' ? '#cfbd92' : enemy.type === 'warrior' ? '#c8b99b' : enemy.boss ? '#d9c8aa' : '#b9ad8c');
    // Legs and rib cage continue animating during the attack.
    ctx.fillStyle = '#483c30'; ctx.fillRect(-tile*.09, -tile*.03, tile*.18, tile*.25);
    ctx.fillStyle = bone;
    ctx.fillRect(-tile*.13, tile*.04, tile*.07, tile*.17 + (attacking ? -swing * tile*.035 : stride*s));
    ctx.fillRect(tile*.04, tile*.04, tile*.07, tile*.17 - (attacking ? -swing * tile*.035 : stride*s));
    ctx.fillRect(-tile*.17,-tile*.07,tile*.34,tile*.045);
    ctx.fillRect(-tile*.16,-tile*.005,tile*.32,tile*.04);
    ctx.fillRect(-tile*.15,tile*.055,tile*.30,tile*.035);

    if (attacking && attackProgress > .12) {
      // Both bony arms jab toward the player; the reach grows during the lunge.
      const reach = tile * (.10 + swing * .30);
      const spread = tile * (.12 + swing * .055);
      ctx.strokeStyle = bone; ctx.lineWidth = Math.max(2, tile * .065); ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(-tile*.16, -tile*.055);
      ctx.lineTo(-tile*.16 + dirX*reach - dirY*spread*.25, -tile*.055 + dirY*reach + dirX*spread*.25);
      ctx.moveTo(tile*.16, -tile*.055);
      ctx.lineTo(tile*.16 + dirX*reach + dirY*spread*.25, -tile*.055 + dirY*reach - dirX*spread*.25);
      ctx.stroke();
    } else {
      ctx.fillRect(-tile*.20,-tile*.07,tile*.055,tile*.25);
      ctx.fillRect(tile*.145,-tile*.07,tile*.055,tile*.25);
    }

    // Skull and eyes glow brighter while a hit is being telegraphed.
    ctx.fillStyle = bone; ctx.fillRect(-tile*.15,-tile*.29,tile*.30,tile*.22);
    ctx.fillRect(-tile*.10,-tile*.34,tile*.20,tile*.07);
    ctx.fillStyle = '#202018'; ctx.fillRect(-tile*.095,-tile*.23,tile*.06,tile*.06); ctx.fillRect(tile*.035,-tile*.23,tile*.06,tile*.06);
    ctx.fillStyle = attacking ? '#ff6a32' : '#d04430'; ctx.shadowColor = attacking ? '#ff351e' : '#a81f16'; ctx.shadowBlur = tile*(attacking ? .3 : .15);
    ctx.fillRect(-tile*.085,-tile*.215,tile*.035,tile*.035); ctx.fillRect(tile*.045,-tile*.215,tile*.035,tile*.035); ctx.shadowBlur = 0;
    ctx.fillStyle = '#4a4030'; ctx.fillRect(-tile*.045,-tile*.13,tile*.09,tile*.035);
    if (attacking) {
      ctx.globalAlpha = .18 + swing * .18; ctx.fillStyle = enemy.ranged ? '#75bfa1' : '#b52d20'; ctx.fillRect(-tile*.3, -tile*.4, tile*.6, tile*.72);
    }
    ctx.restore();
    if (enemy.boss) { const barW=tile*1.35, barY=y-tile*.70;ctx.save();ctx.fillStyle='rgba(0,0,0,.82)';ctx.fillRect(x-barW/2,barY,barW,Math.max(3,tile*.10));ctx.fillStyle='#9b3429';ctx.fillRect(x-barW/2,barY,barW*clamp(enemy.hp/Math.max(1,enemy.maxHp),0,1),Math.max(3,tile*.10));ctx.strokeStyle='rgba(232,182,135,.8)';ctx.strokeRect(x-barW/2,barY,barW,Math.max(3,tile*.10));ctx.restore(); }
  }

  function drawBullets() {
    for (const b of [...bullets, ...hostileBullets]) {
      const p = screenPoint(b.x,b.y), tail = screenPoint(b.x - b.vx*.018,b.y - b.vy*.018);
      ctx.save(); ctx.strokeStyle = b.color; ctx.lineWidth = Math.max(1.3,tile*(b.damage ? .075 : .055)); ctx.globalAlpha = .9;
      ctx.shadowColor = b.color; ctx.shadowBlur = tile*.22; ctx.beginPath(); ctx.moveTo(tail.x,tail.y); ctx.lineTo(p.x,p.y); ctx.stroke(); ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const q = screenPoint(p.x,p.y); ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color; ctx.fillRect(q.x - p.size*tile*.5,q.y - p.size*tile*.5,Math.max(1,p.size*tile),Math.max(1,p.size*tile));
    }
    ctx.globalAlpha = 1;
  }

  function drawTorchGlow(time) {
    const pos = screenPoint(player.x, player.y), dx = pos.x + Math.cos(player.angle)*tile*.42, dy = pos.y + Math.sin(player.angle)*tile*.42;
    const flicker = Math.sin(time*.023)*tile*.04 + Math.sin(time*.039)*tile*.025, radius = tile*6.0 + flicker;
    const glow = ctx.createRadialGradient(dx,dy,tile*.08,dx,dy,radius);
    glow.addColorStop(0,'rgba(255,177,86,.29)'); glow.addColorStop(.23,'rgba(238,119,37,.18)'); glow.addColorStop(.57,'rgba(153,61,22,.075)'); glow.addColorStop(1,'rgba(58,20,8,0)');
    ctx.fillStyle = glow; ctx.fillRect(0,0,viewWidth,viewHeight);
  }

  function prepareAmbientLights() {
    const candidates = [];
    for (const deco of decorations) {
      if (!['lantern', 'fungus', 'fungus-heart', 'chapel-candle'].includes(deco.type)) continue;
      const worldX = deco.x + .5, worldY = deco.y + .5;
      const center = screenPoint(worldX, worldY);
      const radiusTiles = deco.type === 'lantern' ? 2.9 : deco.type === 'fungus-heart' ? 3.25 : deco.type === 'chapel-candle' ? 1.6 : 2.15;
      const radius = tile * radiusTiles;
      if (center.x < -radius || center.y < -radius || center.x > viewWidth + radius || center.y > viewHeight + radius) continue;
      const distance = Math.hypot(worldX - player.x, worldY - player.y);
      candidates.push({ deco, worldX, worldY, center, radius, radiusTiles, distance,
        color: deco.type === 'lantern' || deco.type === 'chapel-candle' ? '#ffad59' : '#62e1a4', power: deco.type === 'lantern' ? .78 : deco.type === 'fungus-heart' ? .82 : deco.type === 'chapel-candle' ? .52 : .59 });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    ambientLights = candidates.slice(0, 13).map(light => ({
      ...light,
      boundary: traceProjectileLight(light.worldX, light.worldY, light.radiusTiles, 22)
    }));
  }

  function drawAmbientGlows(time) {
    for (const light of ambientLights) {
      const { center: p, radius, color, deco } = light;
      const pulse = .88 + Math.sin(time * ((deco.type === 'lantern' || deco.type === 'chapel-candle') ? .014 : .003) + deco.phase) * .12;
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      glow.addColorStop(0, colorWithAlpha(color, ((deco.type === 'lantern' || deco.type === 'chapel-candle') ? .34 : deco.type === 'fungus-heart' ? .42 : .27) * pulse));
      glow.addColorStop(.25, colorWithAlpha(color, ((deco.type === 'lantern' || deco.type === 'chapel-candle') ? .19 : deco.type === 'fungus-heart' ? .24 : .15) * pulse));
      glow.addColorStop(.62, colorWithAlpha(color, .045 * pulse));
      glow.addColorStop(1, colorWithAlpha(color, 0));
      ctx.fillStyle = glow; ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
      ctx.restore();
    }
  }

  function drawAtmosphericMotes(time) {
    // Tiny spores drift only through illuminated open space, so they add movement without becoming UI noise.
    for (let i = 0; i < (reducedMotion ? 10 : 34); i++) {
      const wx = (noiseAt(i, 161, 7) * cols + time * (.000012 + (i % 4) * .000005)) % cols;
      const wy = (noiseAt(i, 163, 9) * rows + Math.sin(time * .0007 + i * 1.9) * .17 + rows) % rows;
      if (!isOpenWorldCell(wx, wy)) continue;
      const nearPlayer = Math.hypot(wx - player.x, wy - player.y) < 6.4;
      const nearLight = ambientLights.some(light => Math.hypot(wx - light.worldX, wy - light.worldY) < light.radiusTiles * .9);
      if (!nearPlayer && !nearLight) continue;
      const p = screenPoint(wx, wy), pulse = .45 + .5 * Math.abs(Math.sin(time * .002 + i));
      const size = i % 7 === 0 ? Math.max(2, tile * .065) : Math.max(1, tile * .027);
      ctx.save(); ctx.globalAlpha = pulse * (nearPlayer ? .44 : .27);
      ctx.fillStyle = i % 3 === 0 ? '#92d49b' : i % 3 === 1 ? '#dbb77a' : '#8ac8bd';
      if (i % 7 === 0) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = tile * .12; }
      ctx.fillRect(Math.round(p.x), Math.round(p.y), size, size); ctx.restore();
    }
  }

  function drawDarkness(time) {
    const pos = screenPoint(player.x, player.y), dx = pos.x + Math.cos(player.angle)*tile*.48, dy = pos.y + Math.sin(player.angle)*tile*.48;
    const radius = tile*(5.9 + Math.sin(time*.021)*.035);
    darknessCtx.clearRect(0,0,darknessCanvas.width,darknessCanvas.height);
    darknessCtx.globalCompositeOperation = 'source-over'; darknessCtx.fillStyle = 'rgba(1,1,1,.972)'; darknessCtx.fillRect(0,0,darknessCanvas.width,darknessCanvas.height);
    darknessCtx.globalCompositeOperation = 'destination-out';
    const cut = darknessCtx.createRadialGradient(dx,dy,tile*.2,dx,dy,radius);
    cut.addColorStop(0,'rgba(0,0,0,1)'); cut.addColorStop(.42,'rgba(0,0,0,.99)'); cut.addColorStop(.72,'rgba(0,0,0,.78)'); cut.addColorStop(1,'rgba(0,0,0,0)');
    darknessCtx.fillStyle = cut; darknessCtx.fillRect(0,0,viewWidth,viewHeight);

    // Scattered lanterns and bioluminescent fungi create small pools of light.
    for (const light of ambientLights) {
      const { center: p, radius, boundary, power } = light;
      darknessCtx.save();
      tracePath(darknessCtx, boundary); darknessCtx.clip();
      const envCut = darknessCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      envCut.addColorStop(0, `rgba(0,0,0,${power})`);
      envCut.addColorStop(.24, `rgba(0,0,0,${power * .76})`);
      envCut.addColorStop(.56, `rgba(0,0,0,${power * .34})`);
      envCut.addColorStop(1, 'rgba(0,0,0,0)');
      darknessCtx.fillStyle = envCut;
      darknessCtx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
      darknessCtx.restore();
    }

    // A shot is a brief moving light source. Remove darkness only inside the
    // line-of-sight polygon, so the glow cannot leak through solid cobblestone.
    for (const light of projectileLights) {
      const { center: p, radius, boundary } = light;
      if (p.x < -radius || p.y < -radius || p.x > viewWidth + radius || p.y > viewHeight + radius) continue;
      darknessCtx.save();
      tracePath(darknessCtx, boundary); darknessCtx.clip();
      const bulletCut = darknessCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      bulletCut.addColorStop(0, 'rgba(0,0,0,.97)');
      bulletCut.addColorStop(.25, 'rgba(0,0,0,.88)');
      bulletCut.addColorStop(.60, 'rgba(0,0,0,.48)');
      bulletCut.addColorStop(1, 'rgba(0,0,0,0)');
      darknessCtx.fillStyle = bulletCut;
      darknessCtx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
      darknessCtx.restore();
    }
    darknessCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(darknessCanvas,0,0,viewWidth,viewHeight);
  }

  function renderFrame(time) {
    drawBackground(time);
    if (!maze.length) return;
    updateCamera(); prepareProjectileLights(); prepareAmbientLights();
    drawMaze(time); drawDecorations(time); drawSecretDoors(time); drawMapMarks(time); drawExit(time); drawEmbers(time); drawWeaponPickups(time); drawLootPickups(time);
    enemies.forEach(e => { if (e.alive) drawSkeleton(e,time); });
    drawTorchGlow(time); drawAmbientGlows(time); drawProjectileGlows(time); drawDarkness(time);
    drawAtmosphericMotes(time); drawBullets(); drawParticles(); drawPlayer(time); drawPickupToast(time); drawObjectiveText();
    if (hitFlash > 0) { ctx.fillStyle = `rgba(180,20,10,${Math.min(.19,hitFlash*.55)})`; ctx.fillRect(0,0,viewWidth,viewHeight); }
    if (showMap) drawMiniMap(time);
  }


  function pointerWorld(event) {
    refreshState();
    updateCamera();
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left, py = event.clientY - rect.top;
    return { worldX: (px - offsetX) / tile, worldY: (py - offsetY) / tile, active: true };
  }

  return {
    resizeCanvas() { refreshState(); renderResizeCanvas(); },
    draw(time) { refreshState(); renderFrame(time); },
    pointerWorld
  };
}
