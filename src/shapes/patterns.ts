import type { Grid } from "./grid";
import type { SelectParam } from "./types";

export type HighlightMode = "off" | "steps" | "groups";

export const highlightParam: SelectParam = {
  kind: "select",
  key: "highlight",
  label: "Highlight patterns",
  options: [
    { value: "off", label: "Off" },
    { value: "steps", label: "Steps" },
    { value: "groups", label: "Groups" },
  ],
  default: "off",
};

export const isHighlightMode = (v: unknown): v is HighlightMode => v === "off" || v === "steps" || v === "groups";

/**
 * The first eight legend entries get their own colour; longer steps share
 * `PATTERN_LONG`. Ordered so neighbouring entries (e.g. 2×2 and 2×3) differ
 * as much as possible in hue and brightness.
 */
const PATTERN_COLORS = ["#ffe119", "#2f6bff", "#ff2d2d", "#22e36b", "#ff3df0", "#19e3ff", "#ff8a00", "#f4f4f4"];
const PATTERN_LONG = "#7d7891";
const PATTERN_OTHER = "#4a4560";
const LONG = PATTERN_COLORS.length + 1;

/** Empty cells reachable from outside the grid, 4-connected. Holes inside the shape stay 0. */
export function outsideAir(grid: Grid): Uint8Array {
  const { width, height, cells } = grid;
  const out = new Uint8Array(width * height);
  const queue: number[] = [];
  const visit = (x: number, y: number) => {
    const i = y * width + x;
    if (cells[i] || out[i]) return;
    out[i] = 1;
    queue.push(i);
  };
  for (let x = 0; x < width; x++) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    visit(0, y);
    visit(width - 1, y);
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    const x = i % width, y = (i - x) / width;
    if (x > 0) visit(x - 1, y);
    if (x < width - 1) visit(x + 1, y);
    if (y > 0) visit(x, y - 1);
    if (y < height - 1) visit(x, y + 1);
  }
  return out;
}

/** Open faces in clockwise order: top, right, bottom, left. */
const FACES = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

interface FaceRuns {
  /** Per cell: the longest run it belongs to, or 0 off the outline. */
  steps: Uint16Array;
  /** Per cell: the id of that run, or -1. */
  best: Int32Array;
  isOpen: (x: number, y: number) => boolean;
}

/**
 * A face run is a straight line of neighbouring blocks that all have the same
 * face open to the outside. Each outline block takes its longest one as its step.
 */
function faceRuns(grid: Grid): FaceRuns {
  const { width, height, cells } = grid;
  const air = outsideAir(grid);
  const steps = new Uint16Array(width * height);
  const best = new Int32Array(width * height).fill(-1);
  const isOpen = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= height || air[y * width + x] === 1;
  let id = 0;

  // [dx, dy] is the open face; runs go along the other axis.
  for (const [dx, dy] of FACES) {
    const lines = dy ? height : width;
    const along = dy ? width : height;
    for (let l = 0; l < lines; l++) {
      let start = 0;
      for (let a = 0; a <= along; a++) {
        const x = dy ? a : l, y = dy ? l : a;
        const onFace = a < along && cells[y * width + x] === 1 && isOpen(x + dx, y + dy);
        if (onFace) continue;
        const length = a - start;
        if (length) {
          for (let b = start; b < a; b++) {
            const i = dy ? l * width + b : b * width + l;
            if (steps[i]! < length) {
              steps[i] = length;
              best[i] = id;
            }
          }
          id++;
        }
        start = a + 1;
      }
    }
  }
  return { steps, best, isOpen };
}

/**
 * For each block on the shape's outer outline, the length of the straight
 * step it belongs to. Shallow stairs read their horizontal steps, steep ones
 * their vertical steps, and a 45° diagonal is all 1s. Other cells are 0.
 */
export function stepLengths(grid: Grid): Uint16Array {
  return faceRuns(grid).steps;
}

/**
 * Walks the outer outline clockwise and groups neighbouring steps of the same
 * length, e.g. a hexagon's diagonal reads 2 2 2 · 1 · 2 2 · 1 · 2 2 2. Returns
 * how many steps are in each outline block's group, or 0 off the outline.
 */
export function stepGroups(grid: Grid): Uint16Array {
  return traceGroups(grid).counts;
}

interface Groups {
  steps: Uint16Array;
  /** Per cell: steps in its group, or 0 off the outline. */
  counts: Uint16Array;
}

function traceGroups(grid: Grid): Groups {
  const { width, cells } = grid;
  const { steps, best, isOpen } = faceRuns(grid);
  const counts = new Uint16Array(cells.length);

  // Boundary edges between a block and the outside, running clockwise with the block on the right.
  // Vertices are numbered y * (width + 1) + x.
  const edgeCell: number[] = [], edgeTo: number[] = [], edgeDir: number[] = [];
  const outgoing = new Map<number, number[]>();
  const corner = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) continue;
    const x = i % width, y = (i - x) / width;
    FACES.forEach(([dx, dy], f) => {
      if (!isOpen(x + dx, y + dy)) return;
      const [ax, ay] = corner[f]!, [bx, by] = corner[(f + 1) % 4]!;
      const from = (y + ay) * (width + 1) + x + ax;
      const e = edgeCell.push(i) - 1;
      edgeTo.push((y + by) * (width + 1) + x + bx);
      edgeDir.push((f + 1) % 4);
      const list = outgoing.get(from);
      if (list) list.push(e);
      else outgoing.set(from, [e]);
    });
  }

  const lengthOf = new Map<number, number>();
  for (let i = 0; i < cells.length; i++) if (best[i]! >= 0) lengthOf.set(best[i]!, steps[i]!);
  const countOf = new Map<number, number>();
  const visited = new Uint8Array(edgeCell.length);
  for (let start = 0; start < edgeCell.length; start++) {
    if (visited[start]) continue;

    // The run ids met along one closed outline, collapsing repeats.
    const runs: number[] = [];
    for (let e = start; e >= 0; ) {
      visited[e] = 1;
      const run = best[edgeCell[e]!]!;
      if (runs[runs.length - 1] !== run) runs.push(run);
      // Where two blocks touch only at a corner, cross over to the other block (left turn first).
      const options = (outgoing.get(edgeTo[e]!) ?? []).filter(o => !visited[o]);
      const turn = (o: number) => (edgeDir[o]! - edgeDir[e]! + 4) % 4;
      e = options.sort((a, b) => TURN_ORDER[turn(a)]! - TURN_ORDER[turn(b)]!)[0] ?? -1;
    }
    if (runs.length > 1 && runs[0] === runs[runs.length - 1]) runs.pop();

    const lengths = runs.map(r => lengthOf.get(r)!);

    // Start at a change of length so a group isn't split across the loop's seam.
    const n = runs.length;
    const seam = Math.max(0, lengths.findIndex((l, k) => l !== lengths[(k - 1 + n) % n]));
    for (let k = 0; k < n; ) {
      let end = k + 1;
      while (end < n && lengths[(seam + end) % n] === lengths[(seam + k) % n]) end++;
      for (let j = k; j < end; j++) {
        const run = runs[(seam + j) % n]!;
        countOf.set(run, Math.max(countOf.get(run) ?? 0, end - k));
      }
      k = end;
    }
  }
  for (let i = 0; i < cells.length; i++) counts[i] = countOf.get(best[i]!) ?? 0;
  return { steps, counts };
}

/** Turn preference by direction change: left (3), straight (0), right (1). */
const TURN_ORDER = [1, 2, 3, 0];

export interface Highlight {
  /** Per cell: index into `legend`, or -1 for no highlight. */
  keys: Int16Array;
  /** Per cell: the step length, drawn on the block when zoomed in. */
  steps: Uint16Array;
  legend: readonly LegendEntry[];
}

export interface LegendEntry {
  /** Stable id for remembering a custom colour, e.g. "groups:2×3". */
  id: string;
  label: string;
  color: string;
}

/** Colours the outer outline by step length, or by step length and group size. */
export function highlight(grid: Grid, mode: HighlightMode): Highlight | null {
  if (mode === "off") return null;
  const traced = traceGroups(grid);
  const { steps } = traced;
  const counts = mode === "groups" ? traced.counts : null;

  // Long flat walls all share one key; otherwise one key per length (and group size).
  const keyOf = (i: number) => {
    const length = Math.min(steps[i]!, LONG);
    return counts && length < LONG ? length * 65536 + counts[i]! : length * 65536;
  };
  const distinct = [...new Set(Array.from(steps.keys()).filter(i => steps[i]).map(keyOf))].sort((a, b) => a - b);
  const short = distinct.filter(k => k < LONG * 65536);

  const legend: LegendEntry[] = [];
  const index = new Map<number, number>();
  const add = (label: string, color: string) => legend.push({ id: `${mode}:${label}`, label, color }) - 1;
  let other = -1;
  short.forEach((k, n) => {
    const length = k >>> 16, count = k & 0xffff;
    const label = counts ? `${length}×${count}` : `${length}`;
    if (counts && n >= PATTERN_COLORS.length) index.set(k, other < 0 ? (other = add("other", PATTERN_OTHER)) : other);
    else index.set(k, add(label, PATTERN_COLORS[counts ? n : length - 1]!));
  });
  if (distinct.length > short.length) index.set(LONG * 65536, add(`${LONG}+`, PATTERN_LONG));

  const keys = new Int16Array(steps.length).fill(-1);
  for (let i = 0; i < steps.length; i++) if (steps[i]) keys[i] = index.get(keyOf(i))!;
  return { keys, steps, legend };
}
