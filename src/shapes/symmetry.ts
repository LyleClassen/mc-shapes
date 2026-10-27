import { gridFrom, isFilled, type Grid } from "./grid";
import type { Parity, ParamValues, SelectParam } from "./types";

/**
 * How a symmetric build centres: on one block (odd sizes) or on a 2×2 group
 * (even sizes). Free leaves sizes alone.
 */
export type CentreType = "free" | "1x1" | "2x2";

export const centreParam: SelectParam = {
  kind: "select",
  key: "centre",
  label: "Centre",
  options: [
    { value: "free", label: "Free" },
    { value: "1x1", label: "1×1" },
    { value: "2x2", label: "2×2" },
  ],
  default: "free",
  hint: v =>
    v.centre === "1x1"
      ? "Odd sizes only: the build centres on a single block."
      : v.centre === "2x2"
        ? "Even sizes only: the build centres on a 2×2 group of blocks."
        : "Any size. Pick 1×1 or 2×2 to keep the centre while scaling.",
};

/** The size parity a centre type needs, for a `NumberParam.parity`. */
export const centreParity = (values: ParamValues): Parity | undefined =>
  values.centre === "1x1" ? "odd" : values.centre === "2x2" ? "even" : undefined;

export interface Axes {
  /** Left–right mirror: the grid matches itself flipped about a vertical line. */
  x: boolean;
  /** Top–bottom mirror: the grid matches itself flipped about a horizontal line. */
  y: boolean;
}

export const NO_AXES: Axes = { x: false, y: false };

/** "↔", "↕", "↔ ↕" or "" for the readouts. */
export const mirrorText = (axes: Axes) => [axes.x && "↔", axes.y && "↕"].filter(Boolean).join(" ");

/** Which ways the grid exactly mirrors onto itself. An empty grid mirrors neither way. */
export function mirrorAxes(grid: Grid): Axes {
  const { width: w, height: h, cells } = grid;
  if (!w || !h) return NO_AXES;
  let x = true, y = true;
  for (let r = 0; r < h && (x || y); r++) {
    for (let c = 0; c < w; c++) {
      const v = cells[r * w + c];
      if (x && v !== cells[r * w + w - 1 - c]) x = false;
      if (y && v !== cells[(h - 1 - r) * w + c]) y = false;
    }
  }
  return { x, y };
}

/**
 * Makes the grid exactly symmetric on the given axes by copying its left half
 * onto the right and its top half onto the bottom. On an odd size the middle
 * column or row is the mirror line and stays as it was.
 */
export function mirrorGrid(grid: Grid, axes: Axes): Grid {
  if (!axes.x && !axes.y) return grid;
  const { width: w, height: h } = grid;
  return gridFrom(w, h, (cx, cy) => {
    const x = Math.floor(cx), y = Math.floor(cy);
    return isFilled(grid, axes.x ? Math.min(x, w - 1 - x) : x, axes.y ? Math.min(y, h - 1 - y) : y);
  });
}
