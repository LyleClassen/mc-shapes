import { getShape } from "../shapes";
import { isFilled } from "../shapes/grid";
import type { Point } from "../shapes/raster";
import { resolveValues, type ParamValues } from "../shapes/types";
import {
  CANVAS_MIN,
  centredPosition,
  layerGrid,
  lineEndpoints,
  resizeCanvas,
  type Canvas,
  type Composite,
  type ImageLayer,
  type Layer,
} from "./composite";
import { imageParams } from "./image";

/** Swaps in a new version of a layer, matched by id. */
export function replaceLayer(composite: Composite, layer: Layer): Composite {
  return { ...composite, layers: composite.layers.map(l => (l.id === layer.id ? layer : l)) };
}

/** Adds a layer just above `aboveId`, or on top when that's null or missing. */
export function insertLayer(composite: Composite, layer: Layer, aboveId: string | null): Composite {
  const i = composite.layers.findIndex(l => l.id === aboveId);
  const layers = [...composite.layers];
  layers.splice(i >= 0 ? i + 1 : layers.length, 0, layer);
  return { ...composite, layers };
}

export function removeLayer(composite: Composite, id: string): Composite {
  return { ...composite, layers: composite.layers.filter(l => l.id !== id) };
}

/** Moves a layer to `index` in the stack (0 = bottom). */
export function reorderLayer(composite: Composite, id: string, index: number): Composite {
  const layer = composite.layers.find(l => l.id === id);
  if (!layer) return composite;
  const layers = composite.layers.filter(l => l.id !== id);
  layers.splice(Math.max(0, Math.min(layers.length, index)), 0, layer);
  return { ...composite, layers };
}

/** The layer directly below `id`, or the one above when it's the bottom one; what to select after deleting it. */
export function neighbourOf(composite: Composite, id: string): string | null {
  const i = composite.layers.findIndex(l => l.id === id);
  if (i < 0) return null;
  return (composite.layers[i - 1] ?? composite.layers[i + 1])?.id ?? null;
}

/** Puts the layer's top-left at canvas x/y. Lines and erasers are stored relative to it, so the whole layer moves. */
export function moveLayer<L extends Layer>(layer: L, x: number, y: number): L {
  return layer.x === x && layer.y === y ? layer : { ...layer, x, y };
}

/** Centres the layer's blocks on the canvas along either or both axes, rounding down like a new shape does. */
export function centreLayer<L extends Layer>(layer: L, canvas: Canvas, horizontally: boolean, vertically: boolean): L {
  const target = centredPosition(layerGrid(layer), canvas);
  return moveLayer(layer, horizontally ? target.x : layer.x, vertically ? target.y : layer.y);
}

/**
 * The layer's centre block on the canvas: its middle block, or on an even
 * side the one just right of (or below) the middle. Its position when empty.
 */
export function layerCentre(layer: Layer): Point {
  const grid = layerGrid(layer);
  return { x: layer.x + Math.floor(grid.width / 2), y: layer.y + Math.floor(grid.height / 2) };
}

/** Moves the layer so its centre block lands on canvas cell `c`. */
export function placeCentre<L extends Layer>(layer: L, c: Point): L {
  const grid = layerGrid(layer);
  return moveLayer(layer, c.x - Math.floor(grid.width / 2), c.y - Math.floor(grid.height / 2));
}

/** New size, trace or Fill for an image layer, growing and shrinking around its centre. */
export function resizeImageLayer(layer: ImageLayer, values: ParamValues): ImageLayer {
  return placeCentre({ ...layer, values }, layerCentre(layer));
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The layer's bounding box on the canvas, or null when it has no cells. */
export function layerBox(layer: Layer): Box | null {
  const grid = layerGrid(layer);
  return grid.width ? { x: layer.x, y: layer.y, width: grid.width, height: grid.height } : null;
}

/**
 * Sizes the canvas to the box around every layer's blocks, hidden ones too,
 * and moves all the layers so that box starts at the canvas's top-left. Erasers
 * only remove blocks, so they move along but don't count towards the box. A box
 * smaller than the minimum canvas is centred on it.
 */
export function fitCanvas(composite: Composite): Composite {
  const boxes = composite.layers.flatMap(l => (l.kind === "eraser" ? [] : (layerBox(l) ?? [])));
  if (!boxes.length) return composite;
  const left = Math.min(...boxes.map(b => b.x)), top = Math.min(...boxes.map(b => b.y));
  const width = Math.max(...boxes.map(b => b.x + b.width)) - left;
  const height = Math.max(...boxes.map(b => b.y + b.height)) - top;
  const dx = Math.max(0, Math.floor((CANVAS_MIN - width) / 2)) - left;
  const dy = Math.max(0, Math.floor((CANVAS_MIN - height) / 2)) - top;
  const layers = composite.layers.map(l => moveLayer(l, l.x + dx, l.y + dy));
  return resizeCanvas({ ...composite, layers }, { width, height });
}

/**
 * The topmost visible layer under canvas cell `p` (Ctrl/⌘-click). A layer
 * with one of its own cells there beats one whose bounding box merely covers
 * it. An eraser's cells are the ones it paints.
 */
export function pickLayer(composite: Composite, p: Point): Layer | null {
  let boxed: Layer | null = null;
  for (let i = composite.layers.length - 1; i >= 0; i--) {
    const layer = composite.layers[i]!;
    if (!layer.visible) continue;
    const grid = layerGrid(layer);
    const x = p.x - layer.x, y = p.y - layer.y;
    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
    if (isFilled(grid, x, y)) return layer;
    boxed ??= layer;
  }
  return boxed;
}

/** A one-line summary for the Layers panel, e.g. "Circle · 21 × 21 · outline". */
export function describeLayer(layer: Layer): string {
  switch (layer.kind) {
    case "shape": {
      const grid = layerGrid(layer);
      const fill = layer.values.fill === "hollow" ? "outline" : "solid";
      return `${getShape(layer.shapeId).name} · ${grid.width} × ${grid.height} · ${fill}`;
    }
    case "line": {
      const [a, b] = lineEndpoints(layer);
      return `${a.x},${a.y} → ${b.x},${b.y}`;
    }
    case "eraser":
      return layer.cells.length === 1 ? "1 cell" : `${layer.cells.length} cells`;
    case "image": {
      const grid = layerGrid(layer);
      const trace = resolveValues(imageParams, layer.values).trace;
      const style = trace === "lines" ? "lines" : layer.values.fill === "hollow" ? "outline" : "solid";
      return `Image · ${grid.width} × ${grid.height} · ${style}`;
    }
  }
}
