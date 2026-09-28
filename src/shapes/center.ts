import { centerGuides, centerSpan, type Grid, type Span } from "./grid";
import type { Point } from "./raster";
import type { CenterHint, SelectParam } from "./types";

type Cells = readonly { x: number; y: number }[];

/** The centre block(s) of a layout plus the guide cells leading to them. */
export interface CenterMarks {
  x: Span;
  y: Span;
  /** Straight lines along the centre column(s) and row(s), out to the walls. */
  straight: Cells;
  /** The shape's own guide lines, when it defines them. */
  shaped?: { label: string; cells: Cells };
}

export type GuideMode = "off" | "straight" | "shaped";

/** The guide picker, as a select param so it renders like the shape's own controls. */
export function guideParam(center: CenterMarks): SelectParam {
  const options = [{ value: "off", label: "Off" }, { value: "straight", label: "Straight" }];
  if (center.shaped) options.push({ value: "shaped", label: center.shaped.label });
  return { kind: "select", key: "guides", label: "Centre guides", options, default: "straight" };
}

/** The mode actually in effect: shape-specific guides fall back to straight on shapes without them. */
export function effectiveGuideMode(mode: GuideMode, center: CenterMarks): GuideMode {
  return mode === "shaped" && !center.shaped ? "straight" : mode;
}

const NO_GUIDES: Cells = [];

export function guideCells(mode: GuideMode, center: CenterMarks): Cells {
  switch (effectiveGuideMode(mode, center)) {
    case "off":
      return NO_GUIDES;
    case "shaped":
      return center.shaped!.cells;
    case "straight":
      return center.straight;
  }
}

/**
 * The block(s) nearest a continuous coordinate: the containing block, or the
 * two either side when it sits (almost) on the line between blocks.
 */
export function spanAround(v: number): Span {
  const n = Math.round(v);
  return Math.abs(v - n) < 0.25 ? { start: n - 1, length: 2 } : { start: Math.floor(v), length: 1 };
}

/**
 * Blocks along a segment: one step per block on its longer axis, taking the
 * block(s) the line passes through at each step's middle. A line running
 * along the boundary between blocks covers both sides, like the centre does.
 */
export function lineCells(a: Point, b: Point): { x: number; y: number }[] {
  const steep = Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
  // Work in (major, minor) coordinates so one loop handles both orientations.
  const [a0, a1, b0, b1] = steep ? [a.y, a.x, b.y, b.x] : [a.x, a.y, b.x, b.y];
  const from = Math.floor(Math.min(a0, b0));
  const to = Math.min(Math.ceil(Math.max(a0, b0)) - 1, from + 10_000);
  const cells: { x: number; y: number }[] = [];
  for (let i = from; i <= Math.max(from, to); i++) {
    const t = b0 === a0 ? 0 : Math.min(1, Math.max(0, (i + 0.5 - a0) / (b0 - a0)));
    const minor = spanAround(a1 + (b1 - a1) * t);
    for (let j = minor.start; j < minor.start + minor.length; j++) cells.push(steep ? { x: j, y: i } : { x: i, y: j });
  }
  return cells;
}

/**
 * Centre and guides for a trimmed grid. Without a hint it's the middle of the
 * bounding box; with one, the hint's point, plus its lines as `shaped` guides.
 * Hint coordinates are shifted by `offset` (how far trimming moved the grid).
 * Straight guides always run from whichever centre was chosen.
 */
export function centerMarks(grid: Grid, hint?: CenterHint, offset = { x: 0, y: 0 }): CenterMarks {
  if (!hint) {
    const x = centerSpan(grid.width), y = centerSpan(grid.height);
    return { x, y, straight: centerGuides(grid, x, y) };
  }

  const shift = (p: Point) => ({ x: p.x - offset.x, y: p.y - offset.y });
  const seen = new Set<number>();
  const guides: { x: number; y: number }[] = [];
  for (const [a, b] of hint.lines) {
    for (const c of lineCells(shift(a), shift(b))) {
      if (c.x < 0 || c.y < 0 || c.x >= grid.width || c.y >= grid.height) continue;
      const key = c.y * grid.width + c.x;
      if (seen.has(key)) continue;
      seen.add(key);
      guides.push(c);
    }
  }
  const center = shift(hint.center);
  const x = spanAround(center.x), y = spanAround(center.y);
  return { x, y, straight: centerGuides(grid, x, y), shaped: { label: hint.label, cells: guides } };
}
