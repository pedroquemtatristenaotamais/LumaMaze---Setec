// Fire sprites are shared by both menu scenes; only the visible scene animates.
let sharedFireSprites;
function getFireSprites() {
  if (sharedFireSprites) return sharedFireSprites;
  const glow = document.createElement('canvas');
  glow.width = glow.height = 128;
  const glowContext = glow.getContext('2d');
  const halo = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  halo.addColorStop(0, 'rgba(255,178,62,.65)');
  halo.addColorStop(.2, 'rgba(250,104,19,.28)');
  halo.addColorStop(.55, 'rgba(206,61,8,.10)');
  halo.addColorStop(1, 'rgba(160,43,4,0)');
  glowContext.fillStyle = halo;
  glowContext.fillRect(0, 0, 128, 128);

  const frameCount = 24;
  const flameWidth = 96;
  const flameHeight = 156;
  const flames = document.createElement('canvas');
  flames.width = flameWidth * frameCount;
  flames.height = flameHeight;
  const fire = flames.getContext('2d');
  for (let frame = 0; frame < frameCount; frame++) {
    fire.save();
    fire.translate(frame * flameWidth, 0);
    const phase = frame / frameCount * Math.PI * 2;
    // Each tongue repeats smoothly, with a hot pale core and a wide red edge.
    for (let tongue = 0; tongue < 5; tongue++) {
      const center = 48 + Math.sin(tongue * 3.7) * 18;
      const tip = 11 + tongue * 10 + Math.sin(phase + tongue * 1.8) * 13;
      const lean = Math.sin(phase + tongue * 2.1) * (8 + tongue);
      const breadth = 22 - tongue * 2;
      const flameGradient = fire.createLinearGradient(0, tip, 0, 146);
      flameGradient.addColorStop(0, 'rgba(255,96,13,0)');
      flameGradient.addColorStop(.12, '#ff6b16');
      flameGradient.addColorStop(.5, '#ffad27');
      flameGradient.addColorStop(.86, '#ffe08b');
      flameGradient.addColorStop(1, '#fff5ce');
      fire.fillStyle = flameGradient;
      fire.beginPath();
      fire.moveTo(center - breadth, 143);
      fire.bezierCurveTo(center - breadth - 12, 112, center + lean - 20, tip + 32, center + lean, tip);
      fire.bezierCurveTo(center + lean - 4, tip + 29, center + breadth + 12, 105, center + breadth, 143);
      fire.quadraticCurveTo(center, 157, center - breadth, 143);
      fire.fill();
    }
    fire.fillStyle = '#fff2bc';
    fire.beginPath();
    fire.moveTo(33, 143);
    fire.quadraticCurveTo(34, 110, 50 + Math.sin(phase) * 6, 81);
    fire.quadraticCurveTo(47, 108, 65, 143);
    fire.fill();
    fire.restore();
  }

  sharedFireSprites = { glow, flames, frameCount, flameWidth, flameHeight };
  return sharedFireSprites;
}

// A small, independent title scene. Masonry and flame frames are drawn once;
// animation only composites those images and a fixed pool of embers at 30 FPS.
export function createTitleScene({ canvas, screen, getReducedMotion = () => false, variant = 'title' }) {
  const context = canvas?.getContext('2d', { alpha: false });
  if (!context || !screen) return { setReducedMotion() {}, setActive() {}, destroy() {} };

  const backdrop = document.createElement('canvas');
  const stone = backdrop.getContext('2d', { alpha: false });
  const { glow, flames, frameCount, flameWidth, flameHeight } = getFireSprites();

  let width = 1;
  let height = 1;
  let scale = 1;
  let torches = [];
  let raf = 0;
  let lastFrame = -Infinity;
  let animationTime = 0;
  let destroyed = false;
  let active = true;
  let suppliedMotion;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const embers = Array.from({ length: 64 }, (_, index) => ({
    side: index % 2,
    offset: (index * .61803398875) % 1,
    drift: Math.sin(index * 13.13),
    speed: .12 + (index % 7) * .015,
    size: index % 5 === 0 ? 2 : 1,
  }));

  function archPath(ctx, cx, spring, rx, ry, bottom) {
    ctx.beginPath();
    ctx.moveTo(cx - rx, bottom);
    ctx.lineTo(cx - rx, spring);
    ctx.ellipse(cx, spring, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(cx + rx, bottom);
    ctx.closePath();
  }

  function paintBackdrop() {
    let seed = 7183;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const cx = width / 2;
    const floor = height * .87;
    const spring = height * .49;
    const mobile = width / height < .85;
    const outer = mobile ? width * .65 : Math.min(width * .435, height * .82);
    const thickness = Math.min(height * .105, width * .09);
    const inner = outer - thickness;
    const rise = height * .435;
    scale = Math.min(width / 1200, height / 750);
    const wallGradient = stone.createLinearGradient(0, 0, width, height);
    wallGradient.addColorStop(0, '#241a14');
    wallGradient.addColorStop(.45, '#17120f');
    wallGradient.addColorStop(1, '#100d0b');
    stone.fillStyle = wallGradient;
    stone.fillRect(0, 0, width, height);

    // Irregular soot-darkened stone courses with warm mineral seams.
    const course = Math.max(29, height / 14);
    for (let y = -course; y < floor; y += course) {
      let x = -(random() * 140);
      while (x < width) {
        const blockWidth = (90 + random() * 85) * Math.max(.6, scale);
        const gray = 20 + Math.floor(random() * 15);
        stone.fillStyle = `rgb(${gray + 9},${gray + 3},${gray - 3})`;
        stone.fillRect(x + 2, y + 2, blockWidth - 4, course - 4);
        stone.fillStyle = 'rgba(181,141,99,.13)';
        stone.fillRect(x + 3, y + 3, blockWidth - 6, 1);
        stone.strokeStyle = 'rgba(8,5,3,.8)';
        stone.lineWidth = 2;
        stone.strokeRect(x + 1, y + 1, blockWidth - 2, course - 2);
        if (random() > .6) {
          stone.fillStyle = 'rgba(161,93,41,.11)';
          stone.fillRect(x + 7, y + 4, blockWidth * random() * .65, 3 + random() * 5);
        }
        if (random() > .5) {
          stone.strokeStyle = 'rgba(0,0,0,.35)';
          stone.lineWidth = 1;
          stone.beginPath();
          stone.moveTo(x + blockWidth * .7, y + 4);
          stone.lineTo(x + blockWidth * .61, y + course * .5);
          stone.lineTo(x + blockWidth * .66, y + course * .67);
          stone.stroke();
        }
        x += blockWidth;
      }
    }

    // A dark opening and receding arches provide depth behind the typography.
    archPath(stone, cx, spring, inner + 3, rise - thickness * .75, floor + 4);
    const depth = stone.createLinearGradient(0, height * .12, 0, floor);
    depth.addColorStop(0, '#080504');
    depth.addColorStop(.72, '#140d09');
    depth.addColorStop(1, '#332116');
    stone.fillStyle = depth;
    stone.fill();
    stone.save();
    stone.clip();
    for (let step = 0; step < 4; step++) {
      const inset = 38 * (step + 1) * Math.max(.65, scale);
      archPath(stone, cx, spring + step * height * .032, inner - inset, rise - thickness - inset * .5, floor);
      stone.strokeStyle = `rgba(151,103,64,${.18 - step * .025})`;
      stone.lineWidth = 8 * Math.max(.7, scale);
      stone.stroke();
    }
    const mist = stone.createRadialGradient(cx, floor, 0, cx, floor, inner);
    mist.addColorStop(0, 'rgba(194,104,36,.14)');
    mist.addColorStop(1, 'rgba(38,20,10,0)');
    stone.fillStyle = mist;
    stone.fillRect(0, 0, width, height);
    stone.restore();

    // Individual arch keystones; their bevels catch the torchlight.
    const archBlocks = 23;
    for (let index = 0; index < archBlocks; index++) {
      const a = Math.PI + index / archBlocks * Math.PI + .004;
      const b = Math.PI + (index + 1) / archBlocks * Math.PI - .004;
      stone.beginPath();
      stone.ellipse(cx, spring, outer, rise, 0, a, b);
      stone.lineTo(cx + inner * Math.cos(b), spring + (rise - thickness * .75) * Math.sin(b));
      stone.ellipse(cx, spring, inner, rise - thickness * .75, 0, b, a, true);
      stone.closePath();
      const gray = 36 + Math.floor(random() * 16);
      stone.fillStyle = `rgb(${gray + 15},${gray + 7},${gray - 3})`;
      stone.fill();
      stone.strokeStyle = '#120b07';
      stone.lineWidth = 3 * Math.max(.5, scale);
      stone.stroke();
      stone.beginPath();
      stone.ellipse(cx, spring, inner + 3, rise - thickness * .75 + 3, 0, a + .008, b - .008);
      stone.strokeStyle = 'rgba(178,145,95,.26)';
      stone.lineWidth = 2;
      stone.stroke();
    }
    for (const side of [-1, 1]) {
      const left = side < 0 ? cx - outer : cx + inner;
      for (let y = spring; y < floor; y += course * 1.2) {
        const gray = 34 + Math.floor(random() * 14);
        stone.fillStyle = `rgb(${gray + 14},${gray + 5},${gray - 4})`;
        stone.fillRect(left + 2, y + 2, thickness - 4, course * 1.2 - 4);
        stone.fillStyle = '#c3945a44';
        stone.fillRect(side < 0 ? left + thickness - 4 : left + 3, y + 4, 2, course * 1.2 - 8);
      }
      stone.fillStyle = '#4c3e30';
      stone.fillRect(left - 7 * scale, floor - 11 * scale, thickness + 14 * scale, 19 * scale);
    }

    // The flagstone floor fans toward the portal's vanishing point.
    const floorGradient = stone.createLinearGradient(0, floor, 0, height);
    floorGradient.addColorStop(0, '#2a1e16');
    floorGradient.addColorStop(1, '#15100c');
    stone.fillStyle = floorGradient;
    stone.fillRect(0, floor, width, height - floor);
    stone.strokeStyle = '#080503b3';
    stone.lineWidth = 2;
    for (let x = -width; x <= width * 2; x += width / 8) {
      stone.beginPath();
      stone.moveTo(cx + (x - cx) * .06, floor);
      stone.lineTo(x, height);
      stone.stroke();
    }
    for (const fraction of [.08, .3, .62]) {
      const y = floor + (height - floor) * fraction;
      stone.fillStyle = '#090604';
      stone.fillRect(0, y, width, 2);
      stone.fillStyle = '#c28c571c';
      stone.fillRect(0, y + 2, width, 1);
    }

    const torchSpread = mobile ? width * .445 : Math.min(width * .38, height * .68);
    const torchY = height * (variant === 'selection' ? (mobile ? .69 : .76) : (mobile ? .76 : .77));
    torches = [-1, 1].map(side => ({ x: cx + side * torchSpread, y: torchY }));
    for (const torch of torches) {
      const s = Math.max(.55, scale);
      // Warm spill on stone is cached; the brighter core will flicker separately.
      stone.drawImage(glow, torch.x - 170 * s, torch.y - 210 * s, 340 * s, 400 * s);
      stone.fillStyle = '#2b2018';
      stone.fillRect(torch.x - 14 * s, torch.y + 27 * s, 28 * s, 85 * s);
      stone.fillStyle = '#6b4c31';
      stone.fillRect(torch.x - 18 * s, torch.y + 24 * s, 36 * s, 8 * s);
      stone.fillStyle = '#17100c';
      stone.fillRect(torch.x - 21 * s, torch.y + 105 * s, 42 * s, 10 * s);
      stone.fillStyle = '#4e3b23';
      stone.beginPath();
      stone.moveTo(torch.x - 31 * s, torch.y);
      stone.lineTo(torch.x + 31 * s, torch.y);
      stone.lineTo(torch.x + 17 * s, torch.y + 26 * s);
      stone.lineTo(torch.x - 17 * s, torch.y + 26 * s);
      stone.closePath();
      stone.fill();
      stone.strokeStyle = '#bb8245';
      stone.lineWidth = 2 * s;
      stone.stroke();
      stone.fillStyle = '#d98b37';
      stone.fillRect(torch.x - 31 * s, torch.y - 2 * s, 62 * s, 4 * s);
      stone.strokeStyle = '#2b1b11';
      for (let bar = -1; bar <= 1; bar++) {
        stone.beginPath();
        stone.moveTo(torch.x + bar * 15 * s, torch.y - 9 * s);
        stone.lineTo(torch.x + bar * 11 * s, torch.y + 23 * s);
        stone.stroke();
      }
    }
    // Scattered rubble keeps the foreground from feeling like a flat backdrop.
    for (let index = 0; index < 28; index++) {
      const x = random() * width;
      const y = floor + random() * (height - floor);
      const s = (4 + random() * 14) * Math.max(.5, scale);
      stone.fillStyle = index % 2 ? '#3f3023' : '#2b2019';
      stone.beginPath();
      stone.moveTo(x, y);
      stone.lineTo(x + s, y - s * .3);
      stone.lineTo(x + s * 1.7, y + s * .6);
      stone.lineTo(x + s * .2, y + s * .7);
      stone.closePath();
      stone.fill();
    }
    const vignette = stone.createRadialGradient(cx, height * .43, height * .18, cx, height * .43, Math.max(width * .65, height * .8));
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.8)');
    stone.fillStyle = vignette;
    stone.fillRect(0, 0, width, height);
  }

  function reducedMotion() {
    return motionQuery.matches || Boolean(suppliedMotion ?? getReducedMotion());
  }

  function isVisible() {
    if (destroyed || !active || document.hidden || screen.closest('.hidden, .is-hidden, [hidden]')) return false;
    // The second scene sleeps while the opening title is in front of it.
    const title = variant === 'selection' ? document.getElementById('titleScreen') : null;
    return !title || title.classList.contains('is-hidden') || title.classList.contains('hidden') || title.hidden;
  }

  function paint(time) {
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    context.drawImage(backdrop, 0, 0);
    const s = Math.max(.55, scale);
    const still = reducedMotion();
    for (let side = 0; side < torches.length; side++) {
      const torch = torches[side];
      const phase = time * 4.1 + side * 2.4;
      const pulse = still ? 1 : 1 + Math.sin(phase) * .07 + Math.sin(phase * 2.7) * .035;
      const radius = 225 * s * pulse;
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = .75;
      context.drawImage(glow, torch.x - radius, torch.y - radius * 1.25, radius * 2, radius * 2);
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      const frame = still ? side * 7 : (Math.floor(time * 18) + side * 9) % frameCount;
      const fireW = 122 * s;
      const fireH = 208 * s * pulse;
      context.drawImage(flames, frame * flameWidth, 0, flameWidth, flameHeight,
        torch.x - fireW / 2, torch.y - fireH * .96, fireW, fireH);
    }
    context.globalCompositeOperation = 'lighter';
    for (const ember of embers) {
      const torch = torches[ember.side];
      const life = (ember.offset + time * ember.speed) % 1;
      const spread = 24 + life * 110;
      const x = torch.x + (ember.drift * spread + Math.sin(life * 8 + ember.offset * 20) * 17) * s;
      const y = torch.y - (30 + life * (height / s * .7)) * s;
      context.globalAlpha = Math.sin(life * Math.PI) * .85;
      context.fillStyle = ember.size === 2 ? '#ffc474' : '#ff7c2b';
      context.fillRect(x, y, Math.max(1, ember.size * s), Math.max(1.5, ember.size * 1.7 * s));
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  }

  function tick(now) {
    raf = 0;
    if (!isVisible()) return;
    if (now - lastFrame >= 1000 / 30 - .5) {
      const elapsed = Number.isFinite(lastFrame) ? Math.min((now - lastFrame) / 1000, .08) : 0;
      animationTime += elapsed;
      lastFrame = now;
      paint(animationTime);
    }
    if (!reducedMotion()) raf = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = -Infinity;
    const reduced = reducedMotion();
    screen.dataset.reducedMotion = String(reduced);
    if (!isVisible()) return;
    paint(reduced ? 2.4 : animationTime);
    if (!reduced) raf = requestAnimationFrame(tick);
  }

  function resize() {
    if (destroyed) return;
    const bounds = screen.getBoundingClientRect();
    const pixelScale = Math.min(1, 1200 / Math.max(1, bounds.width), 850 / Math.max(1, bounds.height),
      Math.sqrt(850000 / Math.max(1, bounds.width * bounds.height)));
    const nextWidth = Math.max(1, Math.floor(bounds.width * pixelScale));
    const nextHeight = Math.max(1, Math.floor(bounds.height * pixelScale));
    if (nextWidth !== width || nextHeight !== height) {
      width = canvas.width = backdrop.width = nextWidth;
      height = canvas.height = backdrop.height = nextHeight;
      paintBackdrop();
    }
    sync();
  }

  const observer = new MutationObserver(sync);
  for (let ancestor = screen; ancestor; ancestor = ancestor.parentElement) {
    observer.observe(ancestor, { attributes: true, attributeFilter: ['class', 'hidden'] });
  }
  const openingTitle = variant === 'selection' ? document.getElementById('titleScreen') : null;
  if (openingTitle) observer.observe(openingTitle, { attributes: true, attributeFilter: ['class', 'hidden'] });
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(screen);
  if (!resizeObserver) window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', sync);
  motionQuery.addEventListener('change', sync);
  resize();

  return {
    setActive(value) {
      const nextActive = Boolean(value);
      if (active === nextActive) return;
      active = nextActive;
      sync();
    },
    setReducedMotion(value) {
      suppliedMotion = typeof value === 'boolean' ? value : undefined;
      sync();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', sync);
      motionQuery.removeEventListener('change', sync);
      // Release the cached backing stores if the application replaces the title.
      backdrop.width = backdrop.height = 1;
    },
  };
}
