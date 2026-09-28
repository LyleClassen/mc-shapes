import { gridFrom, type Grid } from "./grid";

export interface Point {
  x: number;
  y: number;
}

const EPSILON = 1e-9;

/**
 * Fills every cell whose centre lies inside (or exactly on the edge of) a
 * convex polygon. Vertices may wind either way; repeated vertices are fine.
 */
export function rasterConvex(points: readonly Point[], width: number, height: number): Grid {
  let area = 0;
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]!;
    area += a.x * b.y - b.x * a.y;
  });
  const winding = area < 0 ? -1 : 1;

  return gridFrom(width, height, (cx, cy) =>
    points.every((a, i) => {
      const b = points[(i + 1) % points.length]!;
      const cross = (b.x - a.x) * (cy - a.y) - (b.y - a.y) * (cx - a.x);
      return winding * cross >= -EPSILON;
    }),
  );
}

/** Rounds away float noise so right-angle turns land exactly on whole numbers. */
function snap(v: number): number {
  const n = Math.round(v);
  return Math.abs(v - n) < 1e-12 ? n : v;
}

export interface Rotated {
  points: Point[];
  width: number;
  height: number;
  /** Maps any other point (e.g. guide ends) the same way as the outline. */
  apply: (p: Point) => Point;
}

/**
 * Turns an outline clockwise by `degrees`, then centres it in the smallest
 * whole-block box [0, width] × [0, height] that holds `frame` (by default the
 * outline itself). Framing a cut shape by its uncut original keeps the result
 * unchanged at 0°.
 */
export function rotateOutline(points: readonly Point[], degrees: number, frame: readonly Point[] = points): Rotated {
  const rad = (degrees * Math.PI) / 180;
  const cos = snap(Math.cos(rad)), sin = snap(Math.sin(rad));
  const turn = (p: Point): Point => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos });

  const turned = frame.map(turn);
  const xs = turned.map(p => p.x), ys = turned.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX, spanY = Math.max(...ys) - minY;
  const width = Math.max(1, Math.ceil(spanX - EPSILON));
  const height = Math.max(1, Math.ceil(spanY - EPSILON));
  const dx = (width - spanX) / 2 - minX, dy = (height - spanY) / 2 - minY;

  const apply = (p: Point): Point => {
    const t = turn(p);
    return { x: t.x + dx, y: t.y + dy };
  };
  return { points: points.map(apply), width, height, apply };
}

/** Point a fraction `t` of the way from `a` to `b`. */
export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
