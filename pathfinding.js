// One reusable search from the player serves every pursuing enemy.
export function createDistanceField(cols, rows, isWalkable) {
  const distances = new Int32Array(cols * rows);
  const queue = new Int32Array(cols * rows);
  distances.fill(-1);
  const inside = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  let tail = 0, nextDistance = 0;

  function visit(nx, ny) {
    if (!inside(nx, ny)) return;
    const next = ny * cols + nx;
    if (distances[next] >= 0 || !isWalkable(nx, ny)) return;
    distances[next] = nextDistance; queue[tail++] = next;
  }

  function rebuild(targetX, targetY) {
    distances.fill(-1);
    const tx = Math.floor(targetX), ty = Math.floor(targetY);
    if (!inside(tx, ty) || !isWalkable(tx, ty)) return;
    let head = 0; tail = 1;
    queue[0] = ty * cols + tx; distances[queue[0]] = 0;
    while (head < tail) {
      const index = queue[head++], x = index % cols, y = Math.floor(index / cols);
      nextDistance = distances[index] + 1;
      visit(x + 1, y); visit(x - 1, y); visit(x, y + 1); visit(x, y - 1);
    }
  }

  function distanceAt(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    return inside(x, y) ? distances[y * cols + x] : -1;
  }

  function nextStep(fromX, fromY, retreat = false) {
    const x = Math.floor(fromX), y = Math.floor(fromY);
    let best = distanceAt(x, y), result = null;
    if (best < 0) return null;
    if (!retreat && best === 0) return { x: x + .5, y: y + .5 };
    const consider = (nx, ny) => {
      const value = distanceAt(nx, ny);
      if (value < 0 || (retreat ? value <= best : value >= best)) return;
      best = value; result = { x: nx + .5, y: ny + .5 };
    };
    consider(x + 1, y); consider(x - 1, y); consider(x, y + 1); consider(x, y - 1);
    return result;
  }

  return { rebuild, nextStep, distanceAt };
}
