import { describe, expect, test } from "bun:test";
import { centerMarks } from "./center";
import { circle } from "./circle";
import { gridFrom, type Grid } from "./grid";
import { rectangle } from "./rectangle";
import { mirrorAxes, mirrorGrid } from "./symmetry";
import { resolveRange, resolveValues, type NumberParam } from "./types";

const rows = (lines: string[]): Grid =>
  gridFrom(lines[0]!.length, lines.length, (cx, cy) => lines[Math.floor(cy)]![Math.floor(cx)] === "#");

const show = (grid: Grid) =>
  Array.from({ length: grid.height }, (_, y) =>
    Array.from({ length: grid.width }, (_, x) => (grid.cells[y * grid.width + x] ? "#" : ".")).join(""),
  );

describe("centre types", () => {
  test("free keeps any size", () => {
    expect(resolveValues(circle.params, { diameter: 16 }).diameter).toBe(16);
    expect(resolveValues(circle.params, { centre: "free", diameter: 15 }).diameter).toBe(15);
  });

  test("1×1 rounds to odd sizes and 2×2 to even ones", () => {
    expect(resolveValues(circle.params, { centre: "1x1", diameter: 16 }).diameter).toBe(17);
    expect(resolveValues(circle.params, { centre: "2x2", diameter: 15 }).diameter).toBe(16);
    expect(resolveValues(rectangle.params, { centre: "2x2", width: 7, height: 4 })).toMatchObject({ width: 8, height: 4 });
  });

  test("rounds down at the top of the range", () => {
    expect(resolveValues(circle.params, { centre: "1x1", diameter: 1024 }).diameter).toBe(1023);
    expect(resolveValues(circle.params, { centre: "2x2", diameter: 1 }).diameter).toBe(2);
  });

  test("the controls step by 2 between allowed sizes", () => {
    const diameter = circle.params.find(p => p.key === "diameter") as NumberParam;
    expect(resolveRange(diameter, { centre: "free" })).toEqual({ min: 1, max: 1024, step: 1 });
    expect(resolveRange(diameter, { centre: "1x1" })).toEqual({ min: 1, max: 1023, step: 2 });
    expect(resolveRange(diameter, { centre: "2x2" })).toEqual({ min: 2, max: 1024, step: 2 });
  });

  test("a snapped circle centres on 1 or 2×2 blocks and mirrors both ways", () => {
    for (const [centre, length] of [["1x1", 1], ["2x2", 2]] as const) {
      for (let d = 5; d < 30; d++) {
        const grid = circle.build(resolveValues(circle.params, { centre, diameter: d }) as never);
        const marks = centerMarks(grid);
        expect([marks.x.length, marks.y.length]).toEqual([length, length]);
        expect(marks.mirror).toEqual({ x: true, y: true });
      }
    }
  });
});

describe("mirrorAxes", () => {
  test("finds each mirror line", () => {
    expect(mirrorAxes(rows(["#..#", "####"]))).toEqual({ x: true, y: false });
    expect(mirrorAxes(rows(["#..", "...", "#.."]))).toEqual({ x: false, y: true });
    expect(mirrorAxes(rows([".#.", "###", ".#."]))).toEqual({ x: true, y: true });
    expect(mirrorAxes(rows(["#.", ".."]))).toEqual({ x: false, y: false });
  });
});

describe("mirrorGrid", () => {
  test("copies the left half onto the right, keeping an odd middle column", () => {
    expect(show(mirrorGrid(rows(["##.#.", ".#..."]), { x: true, y: false }))).toEqual(["##.##", ".#.#."]);
    expect(show(mirrorGrid(rows(["#...", ".#.."]), { x: true, y: false }))).toEqual(["#..#", ".##."]);
  });

  test("copies the top half onto the bottom", () => {
    expect(show(mirrorGrid(rows(["#.", ".#", ".."]), { x: false, y: true }))).toEqual(["#.", ".#", "#."]);
  });
});
