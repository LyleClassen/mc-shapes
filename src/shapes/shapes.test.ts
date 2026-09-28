import { describe, expect, test } from "bun:test";
import { applyFill } from "./fill";
import { centerGuides, centerSpan, countBlocks, flipHorizontal, hollow, rowCount, rowSegments, trim, type Grid } from "./grid";
import { SHAPES } from "./index";
import { circle } from "./circle";
import { rectangle } from "./rectangle";
import { triangle } from "./triangle";
import { truncatedTriangle } from "./truncatedTriangle";
import { defaultValues, resolveValues } from "./types";

const build = (shape: (typeof SHAPES)[number], values: Record<string, unknown> = {}) =>
  trim(shape.build(resolveValues(shape.params, values as never)));

const same = (a: Grid, b: Grid) =>
  a.width === b.width && a.height === b.height && a.cells.every((c, i) => c === b.cells[i]);

describe("every shape", () => {
  for (const shape of SHAPES) {
    test(`${shape.name} builds a non-empty grid from defaults`, () => {
      const grid = build(shape, defaultValues(shape.params));
      expect(countBlocks(grid)).toBeGreaterThan(0);
      expect(grid.cells.length).toBe(grid.width * grid.height);
    });
  }
});

describe("rectangle", () => {
  test("solid and outline counts", () => {
    const solid = build(rectangle, { width: 10, height: 6 });
    expect(countBlocks(solid)).toBe(60);
    expect(countBlocks(hollow(solid, 1))).toBe(2 * 10 + 2 * 6 - 4);
    expect(countBlocks(hollow(solid, 2))).toBe(60 - 6 * 2);
  });

  test("thick walls fill the whole shape", () => {
    const solid = build(rectangle, { width: 5, height: 5 });
    expect(same(hollow(solid, 10), solid)).toBe(true);
  });

  test("corner radius rounds off the corners", () => {
    const rounded = build(rectangle, { width: 10, height: 10, radius: 3 });
    expect(countBlocks(rounded)).toBeLessThan(100);
    expect(rowCount(rounded, 0)).toBeLessThan(10);
    expect(rowCount(rounded, 5)).toBe(10);
  });
});

describe("circle", () => {
  test("is symmetric", () => {
    for (const diameter of [1, 2, 7, 8, 15, 32]) {
      const grid = build(circle, { diameter });
      expect(grid.width).toBe(diameter);
      expect(same(flipHorizontal(grid), grid)).toBe(true);
    }
  });

  test("outline of a 5-wide circle is the familiar ring", () => {
    const outline = applyFill(build(circle, { diameter: 5 }), { fill: "hollow", thickness: 1 });
    expect(Array.from({ length: 5 }, (_, y) => rowSegments(outline, y).map(s => s.length))).toEqual([
      [1, 3],
      [1, 3, 1],
      [1, 3, 1],
      [1, 3, 1],
      [1, 3],
    ]);
  });
});

describe("triangles", () => {
  test("equilateral triangle has a full-width base and the expected height", () => {
    const grid = build(triangle, { kind: "equilateral", base: 21 });
    expect(grid.width).toBe(21);
    expect(grid.height).toBe(18);
    expect(rowCount(grid, grid.height - 1)).toBe(21);
    expect(rowCount(grid, 0)).toBe(1);
  });

  test("rotating 180° flips the rows", () => {
    const up = build(triangle, { base: 11 });
    const down = build(triangle, { base: 11, rotation: 180 });
    expect(rowCount(down, 0)).toBe(rowCount(up, up.height - 1));
  });

  test("rotating 90° swaps width and height", () => {
    const side = build(triangle, { kind: "isosceles", base: 21, height: 11, rotation: 90 });
    expect(side.width).toBe(11);
    expect(side.height).toBe(21);
    expect(countBlocks(side)).toBe(countBlocks(build(triangle, { kind: "isosceles", base: 21, height: 11 })));
  });

  test("zero cut is the plain equilateral triangle", () => {
    const plain = build(triangle, { kind: "equilateral", base: 30 });
    expect(same(build(truncatedTriangle, { side: 30, cut: 0, corners: "all" }), plain)).toBe(true);
    expect(same(build(truncatedTriangle, { side: 30, cut: 0, corners: "top" }), plain)).toBe(true);
  });

  test("cutting all corners flattens top, and leaves a shorter bottom", () => {
    const grid = build(truncatedTriangle, { side: 30, cut: 10, corners: "all" });
    expect(rowCount(grid, 0)).toBeGreaterThanOrEqual(9);
    expect(rowCount(grid, grid.height - 1)).toBeLessThanOrEqual(11);
    expect(same(flipHorizontal(grid), grid)).toBe(true);
  });

  test("top-only cut keeps the full base", () => {
    const grid = build(truncatedTriangle, { side: 30, cut: 10, corners: "top" });
    expect(rowCount(grid, grid.height - 1)).toBe(30);
    expect(rowCount(grid, 0)).toBeGreaterThanOrEqual(9);
  });

  test("cut is clamped to what the side allows", () => {
    const values = resolveValues(truncatedTriangle.params, { side: 10, cut: 50, corners: "all" });
    expect(values.cut).toBe(4);
  });
});

describe("centerSpan", () => {
  test("odd sizes have a single centre block", () => {
    expect(centerSpan(1)).toEqual({ start: 0, length: 1 });
    expect(centerSpan(9)).toEqual({ start: 4, length: 1 });
  });

  test("even sizes straddle the midline with two blocks", () => {
    expect(centerSpan(2)).toEqual({ start: 0, length: 2 });
    expect(centerSpan(10)).toEqual({ start: 4, length: 2 });
  });
});

describe("centerGuides", () => {
  test("in an outline, guides run from the centre up to the wall", () => {
    const ring = applyFill(build(rectangle, { width: 9, height: 9 }), { fill: "hollow", thickness: 1 });
    const guides = centerGuides(ring);
    expect(guides).toHaveLength(4 * 3);
    expect(guides.every(({ x, y }) => ring.cells[y * ring.width + x] === 0)).toBe(true);
  });

  test("even sizes get two lanes per direction", () => {
    const ring = applyFill(build(rectangle, { width: 10, height: 10 }), { fill: "hollow", thickness: 1 });
    expect(centerGuides(ring)).toHaveLength(4 * 2 * 3);
  });

  test("in a solid shape, guides run out to the edge", () => {
    expect(centerGuides(build(rectangle, { width: 9, height: 9 }))).toHaveLength(4 * 4);
  });
});
