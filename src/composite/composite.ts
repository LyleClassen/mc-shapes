import { getShape } from "../shapes";
import { applyFill, fillParams } from "../shapes/fill";
import { EMPTY_GRID, trim, trimOffset, type Grid } from "../shapes/grid";
import type { Point } from "../shapes/raster";
import { resolveValues, type ParamValues } from "../shapes/types";
import { rasterLine } from "./draw";

export const CANVAS_MIN = 8;
export const CANVAS_MAX = 256;
export const CANVAS_DEFAULT = 128;

export interface Canvas {
  width: number;
  height: number;
}

interface BaseLayer {
  id: string;
  name: string;
  visible: boolean;
  /** Canvas x/y of the top-left of the layer's blocks. Any integer; nothing is clamped. */
  x: number;
  y: number;
}

/** A placed shape. `values` holds the shape's params plus its own Fill and wall thickness. */
export interface ShapeLayer extends BaseLayer {
  kind: "shape";
  shapeId: string;
  values: ParamValues;
}

/** A thin line between two endpoints, stored relative to the position. */
export interface LineLayer extends BaseLayer {
  kind: "line";
  a: Point;
  b: Point;
}

/** Painted cells that remove blocks from the layers below, relative to the position. */
export interface EraserLayer extends BaseLayer {
  kind: "eraser";
  cells: readonly Point[];
}

export type Layer = ShapeLayer | LineLayer | EraserLayer;
export type LayerKind = Layer["kind"];

/** Layers are ordered bottom to top. */
export interface Composite {
  canvas: Canvas;
  layers: readonly Layer[];
}

export const EMPTY_COMPOSITE: Composite = {
  canvas: { width: CANVAS_DEFAULT, height: CANVAS_DEFAULT },
  layers: [],
};

/** Clamps each side into 8–256. Layers keep their x/y, so the canvas grows and shrinks from the right and bottom. */
export function resizeCanvas(composite: Composite, size: Canvas): Composite {
  const side = (n: number) => Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, Math.round(n)));
  return { ...composite, canvas: { width: side(size.width), height: side(size.height) } };
}

/** The shape's trimmed blocks, with Fill worked out on the shape alone. */
export function shapeGrid(shapeId: string, values: ParamValues): Grid {
  const shape = getShape(shapeId);
  const solid = trim(shape.build(resolveValues(shape.params, values)));
  return trim(applyFill(solid, resolveValues(fillParams, values)));
}

/** Top-left and bottom-right of the points, which must not be empty. Loops, as an eraser can hold too many cells to spread. */
const bounds = (points: readonly Point[]) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
};

const gridOfPoints = (points: readonly Point[]): Grid => {
  if (!points.length) return EMPTY_GRID;
  const { maxX, maxY } = bounds(points);
  const width = maxX + 1, height = maxY + 1;
  const cells = new Uint8Array(width * height);
  for (const p of points) cells[p.y * width + p.x] = 1;
  return { width, height, cells };
};

/** The layer's own cells, with its position at (0, 0). For an eraser these are the cells it removes. */
export function layerGrid(layer: Layer): Grid {
  switch (layer.kind) {
    case "shape":
      return shapeGrid(layer.shapeId, layer.values);
    case "line":
      return gridOfPoints(rasterLine(layer.a, layer.b));
    case "eraser":
      return gridOfPoints(layer.cells);
  }
}

/** Calls `visit` with the canvas index of each of the layer's cells that lands on the canvas. */
function forEachOnCanvas(layer: Layer, canvas: Canvas, visit: (i: number) => void) {
  const grid = layerGrid(layer);
  for (let y = 0; y < grid.height; y++) {
    const cy = layer.y + y;
    if (cy < 0 || cy >= canvas.height) continue;
    for (let x = 0; x < grid.width; x++) {
      const cx = layer.x + x;
      if (cx < 0 || cx >= canvas.width || !grid.cells[y * grid.width + x]) continue;
      visit(cy * canvas.width + cx);
    }
  }
}

export interface Flattened {
  /** The trimmed block plan the stats, row guide and copied plan describe. */
  grid: Grid;
  /** Canvas x/y of the plan's top-left cell. */
  origin: Point;
}

/**
 * Walks the visible layers bottom to top on an empty canvas: shapes and lines
 * add their blocks, erasers clear theirs, and anything off the canvas is cut
 * off. The result is trimmed to its blocks.
 */
export function flatten({ canvas, layers }: Composite): Flattened {
  const cells = new Uint8Array(canvas.width * canvas.height);
  for (const layer of layers) {
    if (!layer.visible) continue;
    const value = layer.kind === "eraser" ? 0 : 1;
    forEachOnCanvas(layer, canvas, i => (cells[i] = value));
  }
  const full: Grid = { width: canvas.width, height: canvas.height, cells };
  return { grid: trim(full), origin: trimOffset(full) };
}

/** True when none of the layer's cells land on the canvas. Such a layer is kept, but warned about. */
export function isOffCanvas(layer: Layer, canvas: Canvas): boolean {
  let on = false;
  forEachOnCanvas(layer, canvas, () => (on = true));
  return !on;
}

/** Where a new shape goes: centred on the canvas, rounded down to whole blocks. */
export function centredPosition(grid: Grid, canvas: Canvas): Point {
  return { x: Math.floor((canvas.width - grid.width) / 2), y: Math.floor((canvas.height - grid.height) / 2) };
}

const KIND_NAMES: Record<Exclude<LayerKind, "shape">, string> = { line: "Line", eraser: "Eraser" };

/** The next free auto-name, e.g. "Circle 3" or "Eraser 1". */
export function nextLayerName(layers: readonly Layer[], base: string): string {
  const taken = new Set(layers.map(l => l.name));
  let n = 1;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

const newId = () => crypto.randomUUID();

/** A new, visible shape layer centred on the canvas. */
export function newShapeLayer(composite: Composite, shapeId: string, values: ParamValues): ShapeLayer {
  const shape = getShape(shapeId);
  const pos = centredPosition(shapeGrid(shape.id, values), composite.canvas);
  const name = nextLayerName(composite.layers, shape.name);
  return { kind: "shape", id: newId(), name, visible: true, ...pos, shapeId: shape.id, values };
}

/** The line's endpoints in canvas coordinates. */
export function lineEndpoints(layer: LineLayer): [Point, Point] {
  return [
    { x: layer.x + layer.a.x, y: layer.y + layer.a.y },
    { x: layer.x + layer.b.x, y: layer.y + layer.b.y },
  ];
}

/** Sets both endpoints from canvas coordinates. The position follows their top-left, so nothing moves on screen. */
export function setLineEndpoints<L extends LineLayer>(layer: L, a: Point, b: Point): L {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { ...layer, x, y, a: { x: a.x - x, y: a.y - y }, b: { x: b.x - x, y: b.y - y } };
}

/** A new line between two canvas points, starting where it was drawn. */
export function newLineLayer(composite: Composite, a: Point, b: Point): LineLayer {
  const name = nextLayerName(composite.layers, KIND_NAMES.line);
  const blank: LineLayer = { kind: "line", id: newId(), name, visible: true, x: 0, y: 0, a, b };
  return setLineEndpoints(blank, a, b);
}

/** The eraser's painted cells in canvas coordinates. */
export function eraserCells(layer: EraserLayer): Point[] {
  return layer.cells.map(c => ({ x: layer.x + c.x, y: layer.y + c.y }));
}

/**
 * Paints `cells` (canvas coordinates) into an eraser layer, or with
 * `restore` takes them back out. Only on-canvas cells are stored. The
 * position follows the painted cells' top-left, so nothing moves on screen;
 * a layer emptied by restoring keeps its position.
 */
export function paintEraser<L extends EraserLayer>(
  layer: L,
  cells: readonly Point[],
  canvas: Canvas,
  restore = false,
): L {
  const key = (p: Point) => `${p.x},${p.y}`;
  const painted = new Map(eraserCells(layer).map(p => [key(p), p]));
  for (const p of cells) {
    if (p.x < 0 || p.y < 0 || p.x >= canvas.width || p.y >= canvas.height) continue;
    if (restore) painted.delete(key(p));
    else painted.set(key(p), p);
  }
  const all = [...painted.values()].sort((p, q) => p.y - q.y || p.x - q.x);
  if (!all.length) return { ...layer, cells: [] };
  const { minX: x, minY: y } = bounds(all);
  return { ...layer, x, y, cells: all.map(p => ({ x: p.x - x, y: p.y - y })) };
}

/** A new eraser layer from a first stroke (canvas coordinates). */
export function newEraserLayer(composite: Composite, cells: readonly Point[]): EraserLayer {
  const name = nextLayerName(composite.layers, KIND_NAMES.eraser);
  const blank: EraserLayer = { kind: "eraser", id: newId(), name, visible: true, x: 0, y: 0, cells: [] };
  return paintEraser(blank, cells, composite.canvas);
}

/** A copy of the layer with a new id and the next free name, at the same position. */
export function duplicateLayer(composite: Composite, layer: Layer): Layer {
  const base = layer.name.replace(/ \d+$/, "");
  return { ...layer, id: newId(), name: nextLayerName(composite.layers, base) };
}
