/**
 * PROTOTYPE, throwaway. Just enough of a composite engine to drive the layout
 * prototype for "Composite mode layout and interaction" (issue #7). The real
 * engine is "Build the composite engine" (issue #8); don't import this from it.
 *
 * Simplifications: line endpoints and eraser cells are stored in canvas
 * coordinates, not relative to the position.
 */
import { applyFill, fillParams } from "../shapes/fill";
import { trim, type Grid } from "../shapes/grid";
import { getShape } from "../shapes";
import { defaultValues, resolveValues, type ParamValues } from "../shapes/types";

export interface Pt {
  x: number;
  y: number;
}

interface Base {
  id: string;
  name: string;
  visible: boolean;
}

export interface ShapeLayer extends Base {
  kind: "shape";
  shapeId: string;
  values: ParamValues;
  fill: ParamValues;
  x: number;
  y: number;
}

export interface LineLayer extends Base {
  kind: "line";
  a: Pt;
  b: Pt;
}

export interface EraserLayer extends Base {
  kind: "eraser";
  /** "x,y" keys in canvas coordinates. */
  cells: string[];
}

export type Layer = ShapeLayer | LineLayer | EraserLayer;

export interface Composite {
  width: number;
  height: number;
  /** Bottom to top. */
  layers: Layer[];
}

export const EMPTY_COMPOSITE: Composite = { width: 128, height: 128, layers: [] };

let nextId = 1;
export const newId = () => `l${Date.now().toString(36)}${nextId++}`;

/** A layer's own blocks, as a grid placed at x/y on the canvas. */
export interface Placed {
  grid: Grid;
  x: number;
  y: number;
}

const shapeCache = new Map<string, Grid>();

export function shapeGrid(l: Pick<ShapeLayer, "shapeId" | "values" | "fill">): Grid {
  const key = JSON.stringify([l.shapeId, l.values, l.fill]);
  let g = shapeCache.get(key);
  if (!g) {
    const shape = getShape(l.shapeId);
    g = trim(applyFill(trim(shape.build(resolveValues(shape.params, l.values))), resolveValues(fillParams, l.fill)));
    if (shapeCache.size > 200) shapeCache.clear();
    shapeCache.set(key, g);
  }
  return g;
}

/** Thin 8-connected line, endpoints ordered so dragging either end doesn't make blocks jump. */
export function lineCells(p: Pt, q: Pt): Pt[] {
  let [a, b] = p.x < q.x || (p.x === q.x && p.y <= q.y) ? [p, q] : [q, p];
  const out: Pt[] = [];
  const dx = Math.abs(b.x - a.x), dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
  let err = dx + dy, x = a.x, y = a.y;
  for (;;) {
    out.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return out;
}

function fromPoints(points: Pt[]): Placed {
  if (!points.length) return { grid: { width: 0, height: 0, cells: new Uint8Array(0) }, x: 0, y: 0 };
  const minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y));
  const w = Math.max(...points.map(p => p.x)) - minX + 1, h = Math.max(...points.map(p => p.y)) - minY + 1;
  const cells = new Uint8Array(w * h);
  for (const p of points) cells[(p.y - minY) * w + p.x - minX] = 1;
  return { grid: { width: w, height: h, cells }, x: minX, y: minY };
}

export const parseCell = (k: string): Pt => {
  const [x, y] = k.split(",").map(Number);
  return { x: x!, y: y! };
};

export function placed(l: Layer): Placed {
  switch (l.kind) {
    case "shape":
      return { grid: shapeGrid(l), x: l.x, y: l.y };
    case "line":
      return fromPoints(lineCells(l.a, l.b));
    case "eraser":
      return fromPoints(l.cells.map(parseCell));
  }
}

export function position(l: Layer): Pt {
  const p = placed(l);
  return l.kind === "shape" ? { x: l.x, y: l.y } : { x: p.x, y: p.y };
}

export function moveBy(l: Layer, dx: number, dy: number): Layer {
  if (!dx && !dy) return l;
  switch (l.kind) {
    case "shape":
      return { ...l, x: l.x + dx, y: l.y + dy };
    case "line":
      return { ...l, a: { x: l.a.x + dx, y: l.a.y + dy }, b: { x: l.b.x + dx, y: l.b.y + dy } };
    case "eraser":
      return { ...l, cells: l.cells.map(k => { const p = parseCell(k); return `${p.x + dx},${p.y + dy}`; }) };
  }
}

/** Canvas-sized flatten (untrimmed), bottom to top; hidden layers drop out. */
export function flatten(c: Composite, upTo = c.layers.length): Grid {
  const { width, height } = c;
  const cells = new Uint8Array(width * height);
  for (const l of c.layers.slice(0, upTo)) {
    if (!l.visible) continue;
    const { grid, x, y } = placed(l);
    const v = l.kind === "eraser" ? 0 : 1;
    for (let gy = 0; gy < grid.height; gy++) {
      const cy = y + gy;
      if (cy < 0 || cy >= height) continue;
      for (let gx = 0; gx < grid.width; gx++) {
        const cx = x + gx;
        if (cx < 0 || cx >= width || !grid.cells[gy * grid.width + gx]) continue;
        cells[cy * width + cx] = v;
      }
    }
  }
  return { width, height, cells };
}

export function hits(l: Layer, p: Pt): boolean {
  const { grid, x, y } = placed(l);
  const gx = p.x - x, gy = p.y - y;
  return gx >= 0 && gy >= 0 && gx < grid.width && gy < grid.height && grid.cells[gy * grid.width + gx] === 1;
}

export function inBox(l: Layer, p: Pt): boolean {
  const { grid, x, y } = placed(l);
  return p.x >= x && p.y >= y && p.x < x + grid.width && p.y < y + grid.height;
}

/** Visible layers under a cell, topmost first: exact block hits, then bounding boxes. */
export function layersAt(c: Composite, p: Pt): Layer[] {
  const top = [...c.layers].reverse().filter(l => l.visible);
  const exact = top.filter(l => hits(l, p));
  return [...exact, ...top.filter(l => !exact.includes(l) && inBox(l, p))];
}

export function isOffCanvas(c: Composite, l: Layer): boolean {
  const { grid, x, y } = placed(l);
  if (!grid.width) return false;
  return x + grid.width <= 0 || y + grid.height <= 0 || x >= c.width || y >= c.height;
}

export function describe(l: Layer): string {
  switch (l.kind) {
    case "shape": {
      const g = shapeGrid(l);
      return `${getShape(l.shapeId).name} · ${g.width}×${g.height}${l.fill.fill === "hollow" ? " · outline" : ""}`;
    }
    case "line":
      return `Line · ${lineCells(l.a, l.b).length} blocks`;
    case "eraser":
      return l.cells.length ? `Eraser · ${l.cells.length} cells` : "Eraser · empty";
  }
}

export function makeShapeLayer(c: Composite, shapeId: string, at?: Pt): ShapeLayer {
  const shape = getShape(shapeId);
  const base = { shapeId, values: defaultValues(shape.params), fill: defaultValues(fillParams) };
  const g = shapeGrid(base);
  const count = c.layers.filter(l => l.kind === "shape" && l.shapeId === shapeId).length;
  // `at` is the cursor: the shape is centred on it. No `at` means centred on the canvas.
  const cx = at?.x ?? Math.floor(c.width / 2), cy = at?.y ?? Math.floor(c.height / 2);
  return {
    kind: "shape",
    id: newId(),
    name: `${shape.name} ${count + 1}`,
    visible: true,
    ...base,
    x: cx - Math.floor(g.width / 2),
    y: cy - Math.floor(g.height / 2),
  };
}

export function nameFor(c: Composite, kind: "line" | "eraser"): string {
  return `${kind === "line" ? "Line" : "Eraser"} ${c.layers.filter(l => l.kind === kind).length + 1}`;
}

/** Shift-snap: keep the line at 0°, 45° or 90° from `a`. */
export function snap45(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x, dy = b.y - a.y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax > 2 * ay) return { x: b.x, y: a.y };
  if (ay > 2 * ax) return { x: a.x, y: b.y };
  const d = Math.max(ax, ay);
  return { x: a.x + Math.sign(dx) * d, y: a.y + Math.sign(dy) * d };
}

/** Square brush cells along a pointer segment, clipped to the canvas. */
export function brushCells(c: Composite, from: Pt, to: Pt, size: number): string[] {
  const out: string[] = [];
  const off = Math.floor((size - 1) / 2);
  for (const p of lineCells(from, to)) {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const x = p.x - off + dx, y = p.y - off + dy;
        if (x >= 0 && y >= 0 && x < c.width && y < c.height) out.push(`${x},${y}`);
      }
    }
  }
  return out;
}

export function rectCells(c: Composite, a: Pt, b: Pt): string[] {
  const out: string[] = [];
  const x0 = Math.max(0, Math.min(a.x, b.x)), x1 = Math.min(c.width - 1, Math.max(a.x, b.x));
  const y0 = Math.max(0, Math.min(a.y, b.y)), y1 = Math.min(c.height - 1, Math.max(a.y, b.y));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(`${x},${y}`);
  return out;
}
