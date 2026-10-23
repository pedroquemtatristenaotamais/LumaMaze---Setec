// Optional developer check. No automation code is loaded by the published game.
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || 'puppeteer');
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || undefined,
  headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    if (request.url().endsWith('/game.js')) return request.respond({ status: 200, contentType: 'text/javascript', body: '' });
    if (request.url().endsWith('/renderer.js')) {
      const source = await (await fetch(request.url())).text();
      assert.ok(source.includes('getMetrics() { return { ...metrics }; }'));
      return request.respond({ status: 200, contentType: 'text/javascript', body: source.replace(
        'getMetrics() { return { ...metrics }; }',
        'getMetrics() { return { ...metrics, testTorch: torchLight }; }') });
    }
    request.continue();
  });
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8080', { waitUntil: 'networkidle0' });
  const report = await page.evaluate(async () => {
    document.body.innerHTML = '';
    const { createRenderer } = await import('./renderer.js');
    const canvas = document.createElement('canvas'); canvas.id = 'mazeCanvas'; document.body.append(canvas);
    const maze = Array.from({ length: 31 }, () => Array(31).fill(1));
    for (let y = 5; y <= 24; y++) for (let x = 5; x <= 24; x++) maze[y][x] = 0;
    for (let y = 5; y <= 24; y++) maze[y][13] = 1;
    maze[15][13] = 0;
    const door = { x: 13, y: 15, opened: false };
    const state = { maze, rows: 31, cols: 31, player: { x: 11.5, y: 11.5, angle: 0, moving: false },
      exit: { x: 24, y: 24 }, coins: [], weaponPickups: [], lootPickups: [], secretDoors: [door],
      enemies: [], bullets: [], hostileBullets: [], particles: [], floatingTexts: [], pickupToast: '',
      pickupToastUntil: 0, hitFlash: 0, brightness: .5, reducedMotion: true, graphicsQuality: 'high' };
    const renderer = createRenderer({ canvas, canvasWrap: { getBoundingClientRect: () => ({ width: 1440, height: 900 }) }, getState: () => state });
    renderer.resizeCanvas(); renderer.draw(10000);
    const first = renderer.getMetrics();
    const snapshot = () => JSON.stringify(renderer.getMetrics().testTorch.boundary);
    const initialGeometry = snapshot();
    let aimStable = true;
    for (let i = 0; i < 24; i++) {
      state.player.angle = i / 24 * Math.PI * 2; renderer.draw(10100 + i * 20);
      aimStable &&= snapshot() === initialGeometry;
    }
    const stationary = renderer.getMetrics();
    const origin = stationary.torchOrigin;
    let movementTracks = true;
    for (let i = 0; i < 25; i++) {
      state.player.x += .01; renderer.draw(11000 + i * 16.7);
      const metrics = renderer.getMetrics();
      movementTracks &&= Math.abs(metrics.torchOrigin.x - state.player.x) < 1e-10;
    }
    const alphaAt = (x, y) => {
      const light = renderer.getMetrics().testTorch, surface = light.cutCanvas;
      const scale = surface.width / (light.radiusTiles * 2);
      const px = Math.round(surface.width / 2 + (x - light.worldX) * scale);
      const py = Math.round(surface.height / 2 + (y - light.worldY) * scale);
      return surface.getContext('2d').getImageData(px, py, 1, 1).data[3];
    };
    const wallOcclusion = alphaAt(14.5, 11.5);
    state.player.x = 11.5; state.player.y = 15.5; renderer.draw(12000);
    const sealedDoor = alphaAt(14.5, 15.5);
    door.opened = true; renderer.draw(12017);
    const openDoor = alphaAt(14.5, 15.5);
    let maxBytes = 0;
    for (let i = 0; i < 36; i++) {
      state.player.x = 6.5 + i % 6 * 3; state.player.y = 6.5 + Math.floor(i / 6) * 3;
      renderer.draw(13000 + i * 17); maxBytes = Math.max(maxBytes, renderer.getMetrics().cacheBytes);
    }
    renderer.draw(14000); const warm = renderer.getMetrics();
    state.player.x = 11.5; state.player.y = 11.5; renderer.draw(14100);
    const fullFrame = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0, green = 0;
    for (let index = 0; index < fullFrame.length; index += 44) {
      const r = fullFrame[index], g = fullFrame[index + 1], b = fullFrame[index + 2];
      if (Math.max(r, g, b) <= 12) continue;
      colored++; if (g > r * 1.12 && g > b * 1.08) green++;
    }
    return { aimStable, movementTracks, origin, visibleCols: first.visibleCols, tile: first.tile,
      shadowRevisionsWhileAiming: stationary.shadowRevision - first.shadowRevision,
      wallOcclusion, sealedDoor, openDoor, maxCacheBytes: maxBytes,
      warmChunkBuilds: warm.chunkBuilds, greenShare: green / Math.max(1, colored) };
  });
  assert.equal(report.aimStable, true, 'stationary aim leaves shadows unchanged');
  assert.equal(report.shadowRevisionsWhileAiming, 0);
  assert.equal(report.movementTracks, true, 'small movements do not quantize the light source');
  assert.ok(report.visibleCols <= 24 && report.tile >= 70, 'camera closely frames the character');
  assert.equal(report.wallOcclusion, 0, 'light does not cross a stone divider');
  assert.equal(report.sealedDoor, 0);
  assert.ok(report.openDoor > 0, 'opening a door updates the light mask immediately');
  assert.ok(report.maxCacheBytes <= 32 * 1024 * 1024);
  assert.equal(report.warmChunkBuilds, 0, 'stationary camera reuses terrain');
  assert.ok(report.greenShare < .02, 'warm materials dominate the rendered room');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: '/tmp/ultima-warm-shadow-check.png' });
  console.log(JSON.stringify({ status: 'pass', ...report }, null, 2));
  await writeFile('/tmp/ultima-visual-check.json', JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
