import type { Point } from "../shapes/raster";

/**
 * The cells of a thin (8-connected) line from `a` to `b`, one per step, with
 * diagonal steps joining at the corners. The endpoints are put in a fixed
 * order first, so swapping them, or dragging either handle, never changes
 * which cells the same pair draws. `a` = `b` gives a single cell.
 */
export function rasterLine(a: Point, b: Point): Point[] {
  const [p, q] = a.x < b.x || (a.x === b.x && a.y <= b.y) ? [a, b] : [b, a];
  const dx = Math.abs(q.x - p.x), dy = -Math.abs(q.y - p.y);
  const sx = q.x > p.x ? 1 : -1, sy = q.y > p.y ? 1 : -1;
  const out: Point[] = [];
  let { x, y } = p;
  let err = dx + dy;
  for (;;) {
    out.push({ x, y });
    if (x === q.x && y === q.y) return out;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/**
 * Snaps `to` so the line from `from` runs at 0°, 45° or 90° (Shift while
 * drawing or dragging a handle). The nearest of the eight directions wins;
 * a diagonal takes the longer of the two distances.
 */
export function snapLine(from: Point, to: Point): Point {
  const dx = to.x - from.x, dy = to.y - from.y;
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  if (octant === 0 || Math.abs(octant) === 4) return { x: to.x, y: from.y };
  if (Math.abs(octant) === 2) return { x: from.x, y: to.y };
  const d = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: from.x + Math.sign(dx) * d, y: from.y + Math.sign(dy) * d };
}

/**
 * The cells a square eraser brush of `size` (1–8) covers as it is dragged
 * through `samples`. Gaps between samples are joined with a line, so a fast
 * drag doesn't skip cells. The brush is centred on each cell, leaning up and
 * left on even sizes.
 */
export function brushCells(samples: readonly Point[], size: number): Point[] {
  const lo = -Math.floor((size - 1) / 2), hi = lo + size - 1;
  const path = samples.flatMap((p, i) => (i === 0 ? [p] : rasterLine(samples[i - 1]!, p)));
  const seen = new Set<string>();
  const out: Point[] = [];
  for (const p of path) {
    for (let y = p.y + lo; y <= p.y + hi; y++) {
      for (let x = p.x + lo; x <= p.x + hi; x++) {
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x, y });
      }
    }
  }
  return out;
}

/** Every cell in the box with corners `a` and `b`, both included. */
export function rectCells(a: Point, b: Point): Point[] {
  const out: Point[] = [];
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push({ x, y });
  }
  return out;
}
