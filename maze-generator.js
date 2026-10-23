// Procedural maze construction, corridor widening and themed chambers.
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// Numeric seeds make layouts reproducible for verification; normal play stays random.
export function createSeededRandom(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let mixed = Math.imul(value ^ value >>> 15, value | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Cell values: 1 = solid wall, 0 = regular corridor,
 * 2 = flooded crypt, 3 = abandoned chapel, 4 = fungal grove.
 */
function stampThemedRooms(grid, rng) {
  const height = grid.length;
  const width = grid[0].length;
  const specs = [
    { id: 2, tx: .27, ty: .38, halfW: 2, halfH: 2 },  // flooded crypt
    { id: 3, tx: .72, ty: .32, halfW: 3, halfH: 2 },  // chapel
    { id: 4, tx: .53, ty: .75, halfW: 2, halfH: 3 }   // fungal grove
  ];
  const rooms = [];

  for (const spec of specs) {
    const targetX = width * spec.tx;
    const targetY = height * spec.ty;
    const candidates = [];
    for (let y = 3; y < height - 3; y++) {
      for (let x = 3; x < width - 3; x++) {
        if (grid[y][x] !== 0) continue;
        // Preserve a safe starting area and give the exit room to breathe.
        if (dist(x, y, 1, 1) < 6 || dist(x, y, width - 2, height - 2) < 5.5) continue;
        const overlaps = rooms.some(room =>
          Math.abs(x - room.x) <= spec.halfW + room.halfW + 1 &&
          Math.abs(y - room.y) <= spec.halfH + room.halfH + 1
        );
        if (overlaps) continue;
        const targetDistance = Math.hypot((x - targetX) * 1.0, (y - targetY) * 1.12);
        candidates.push({ x, y, score: targetDistance + rng() * 2.4 });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    const center = candidates[0];
    if (!center) continue;

    // Widen this connected path into a proper chamber. The existing corridor
    // crosses its center, so carving the room never disconnects the maze.
    for (let y = center.y - spec.halfH; y <= center.y + spec.halfH; y++) {
      for (let x = center.x - spec.halfW; x <= center.x + spec.halfW; x++) {
        if (x > 0 && y > 0 && x < width - 1 && y < height - 1) grid[y][x] = spec.id;
      }
    }
    rooms.push({ x: center.x, y: center.y, halfW: spec.halfW, halfH: spec.halfH, id: spec.id });
  }
}

export function makeMaze(width, height, stage = 1, random = Math.random) {
  const rng = typeof random === 'function' ? random : createSeededRandom(random);
  const randInt = max => Math.floor(rng() * max);
  const grid = Array.from({ length: height }, () => Array(width).fill(1));
  const stack = [{ x: 1, y: 1 }];
  grid[1][1] = 0;
  const directions = [{ x: 0, y: -2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: -2, y: 0 }];

  while (stack.length) {
    const current = stack[stack.length - 1];
    const dirs = directions.slice();
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = randInt(i + 1); [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    let carved = false;
    for (const dir of dirs) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (nx > 0 && ny > 0 && nx < width - 1 && ny < height - 1 && grid[ny][nx] === 1) {
        grid[current.y + dir.y / 2][current.x + dir.x / 2] = 0;
        grid[ny][nx] = 0;
        stack.push({ x: nx, y: ny });
        carved = true;
        break;
      }
    }
    if (!carved) stack.pop();
  }

  // More loops and junctions make later stages less predictable.
  const loopChance = .105 + Math.min(stage, 8) * .007;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (grid[y][x] !== 1 || rng() > loopChance) continue;
      const horizontal = grid[y][x - 1] === 0 && grid[y][x + 1] === 0;
      const vertical = grid[y - 1][x] === 0 && grid[y + 1][x] === 0;
      if (horizontal || vertical) grid[y][x] = 0;
    }
  }

  // Small side chambers make the layout less repetitive before the set pieces.
  const chambers = Math.max(5, Math.floor((width * height) / 300));
  for (let i = 0; i < chambers; i++) {
    const x = 2 + randInt(Math.max(1, width - 4));
    const y = 2 + randInt(Math.max(1, height - 4));
    if (grid[y][x] !== 0 || rng() > .72) continue;
    const roomW = rng() < .45 ? 2 : 3;
    const roomH = rng() < .45 ? 2 : 3;
    for (let ry = 0; ry < roomH; ry++) {
      for (let rx = 0; rx < roomW; rx++) {
        const tx = x + rx - 1, ty = y + ry - 1;
        if (tx > 0 && ty > 0 && tx < width - 1 && ty < height - 1) grid[ty][tx] = 0;
      }
    }
  }

  stampThemedRooms(grid, rng);
  return grid;
}

// Expanding each logical cell into 2x2 visual cells widens corridors while
// preserving chamber IDs so they can be rendered with their own materials.
export function widenMaze(source) {
  const wide = Array.from({ length: source.length * 2 }, () => Array(source[0].length * 2).fill(1));
  for (let y = 0; y < source.length; y++) {
    for (let x = 0; x < source[0].length; x++) {
      const cell = source[y][x];
      if (cell === 1) continue;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) wide[y * 2 + dy][x * 2 + dx] = cell;
      }
    }
  }
  return wide;
}
