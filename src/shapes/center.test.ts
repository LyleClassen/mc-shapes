import { describe, expect, test } from "bun:test";
import { applyFill } from "./fill";
import { centerMarks, lineCells, spanAround } from "./center";
import { flipVertical, trim, trimOffset } from "./grid";
import { truncatedTriangle } from "./truncatedTriangle";
import { resolveValues, type ParamValues } from "./types";

const marksFor = (input: ParamValues, fill: ParamValues = { fill: "solid" }) => {
  const values = resolveValues(truncatedTriangle.params, input);
  const built = truncatedTriangle.build(values);
  const grid = applyFill(trim(built), fill);
  return { grid, marks: centerMarks(grid, truncatedTriangle.center!(values), trimOffset(built)) };
};

describe("spanAround", () => {
  test("a point inside a block is that block", () => {
    expect(spanAround(17.33)).toEqual({ start: 17, length: 1 });
  });

  test("a point on the line between blocks straddles both", () => {
    expect(spanAround(15)).toEqual({ start: 14, length: 2 });
    expect(spanAround(4.9)).toEqual({ start: 4, length: 2 });
  });
});

describe("lineCells", () => {
  test("straight and diagonal lines step one block at a time", () => {
    expect(lineCells({ x: 0.5, y: 0 }, { x: 0.5, y: 4 })).toHaveLength(4);
    expect(lineCells({ x: 0, y: 0 }, { x: 4, y: 4 })).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 },
    ]);
  });

  test("a line along a block boundary covers the blocks on both sides", () => {
    expect(lineCells({ x: 2, y: 0 }, { x: 2, y: 2 })).toEqual([
      { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 },
    ]);
  });
});

describe("truncated triangle centre", () => {
  test("sits at the centroid, two thirds of the way down, not the bounding-box middle", () => {
    // side 30 → triangle height 26, centroid y = 17.33. The top cut sits at
    // y = 5.2 and the bottom corner cuts clear 3 columns, so trimming
    // shifts by (3, 5): centre x 15 → 12 (blocks 11–12), y 17.33 → row 12.
    const { grid, marks } = marksFor({ side: 30, cut: 6, corners: "all" });
    expect(grid.height).toBe(21);
    expect(marks.x).toEqual({ start: 11, length: 2 });
    expect(marks.y).toEqual({ start: 12, length: 1 });
  });

  test("guides run from each cut's midpoint to the centre", () => {
    const { grid, marks } = marksFor({ side: 30, cut: 6, corners: "all" });
    const has = (x: number, y: number) => marks.shaped!.cells.some(g => g.x === x && g.y === y);
    expect(has(11, 11) && has(12, 11)).toBe(true); // reaches the centre, both columns
    expect(has(11, 0) && has(12, 0)).toBe(true); // from the top cut's midpoint
    const bottomLeft = marks.shaped!.cells.filter(g => g.x < 8 && g.y > 12);
    const bottomRight = marks.shaped!.cells.filter(g => g.x > 15 && g.y > 12);
    expect(bottomLeft.length).toBeGreaterThan(0);
    expect(bottomRight.length).toBe(bottomLeft.length);
    expect(marks.shaped!.cells.every(g => g.x >= 0 && g.y >= 0 && g.x < grid.width && g.y < grid.height)).toBe(true);
  });

  test("rotating 180° flips the centre with the shape", () => {
    const up = marksFor({ side: 30, cut: 6 });
    const down = marksFor({ side: 30, cut: 6, rotation: 180 });
    // Flipped centroid y = 26 − 17.33 = 8.67; the empty rows are now at the bottom.
    expect(down.marks.y).toEqual({ start: 8, length: 1 });
    expect(down.marks.shaped!.cells.length).toBe(up.marks.shaped!.cells.length);
    expect(flipVertical(up.grid).cells).toEqual(down.grid.cells);
  });

  test("guides stay on the grid at any angle", () => {
    const { grid, marks } = marksFor({ side: 30, cut: 6, rotation: 37 });
    expect(marks.shaped!.cells.length).toBeGreaterThan(0);
    expect(marks.x.start).toBeGreaterThan(0);
    expect(marks.y.start).toBeGreaterThan(0);
    expect(marks.x.start).toBeLessThan(grid.width);
    expect(marks.y.start).toBeLessThan(grid.height);
  });

  test("top-only cut still centres on the centroid", () => {
    // Top cut at y = 8.67 trims 9 rows (row 8's middle is above the cut): centroid 17.33 → row 8.
    const { marks } = marksFor({ side: 30, cut: 10, corners: "top" });
    expect(marks.y).toEqual({ start: 8, length: 1 });
  });

  test("straight guides run from the centroid, not the bounding-box middle", () => {
    const { grid, marks } = marksFor({ side: 30, cut: 6, corners: "all" });
    // Solid: the centre row's lanes run out to the side walls, so they fill row 12 bar the centre.
    const row12 = marks.straight.filter(g => g.y === 12);
    expect(row12.length + marks.x.length).toBe(Array.from(grid.cells.slice(12 * grid.width, 13 * grid.width)).filter(Boolean).length);
    expect(marks.straight.some(g => g.y === Math.floor(grid.height / 2) && g.x < 5)).toBe(false);
  });
});
