import { describe, expect, test } from "bun:test";
import { circle } from "./circle";
import { gridFrom, hollow, trim, type Grid } from "./grid";
import { highlight, stepGroups, stepLengths } from "./patterns";
import { polygon } from "./polygon";
import { resolveValues } from "./types";

/** Parses rows of `#` (block) and `.` (air). */
const parse = (...rows: string[]): Grid =>
  gridFrom(rows[0]!.length, rows.length, (cx, cy) => rows[Math.floor(cy)]![Math.floor(cx)] === "#");

/** Step lengths as rows, `.` for 0. */
const show = (grid: Grid) => {
  const steps = stepLengths(grid);
  return Array.from({ length: grid.height }, (_, y) =>
    Array.from({ length: grid.width }, (_, x) => steps[y * grid.width + x] || ".").join(""),
  );
};

describe("stepLengths", () => {
  test("a 45° diagonal is all 1s", () => {
    expect(show(parse("#...", ".#..", "..#.", "...#"))).toEqual(["1...", ".1..", "..1.", "...1"]);
  });

  test("a shallow stair alternates its step lengths", () => {
    expect(show(parse("##.....", "..#....", "...##..", ".....#."))).toEqual([
      "22.....",
      "..1....",
      "...22..",
      ".....1.",
    ]);
  });

  test("a solid rectangle marks its edges with the side lengths", () => {
    expect(show(parse("#####", "#####", "#####", "#####"))).toEqual(["55555", "4...4", "4...4", "55555"]);
  });

  test("a thick hollow wall only marks its outer face", () => {
    const grid = hollow(parse("#######", "#######", "#######", "#######", "#######", "#######", "#######"), 2);
    expect(show(grid)).toEqual([
      "7777777",
      "7.....7",
      "7.....7",
      "7.....7",
      "7.....7",
      "7.....7",
      "7777777",
    ]);
  });

  test("a solid circle marks only its outer ring", () => {
    const grid = trim(circle.build(resolveValues(circle.params, { diameter: 21 })));
    const ring = hollow(grid, 1);
    const steps = stepLengths(grid);
    expect(Array.from(steps, s => Number(s > 0))).toEqual(Array.from(ring.cells));
  });
});

/** Group sizes as rows, `.` for air and `#` for blocks off the outline. */
const showGroups = (grid: Grid) => {
  const counts = stepGroups(grid);
  return Array.from({ length: grid.height }, (_, y) =>
    Array.from({ length: grid.width }, (_, x) => {
      const i = y * grid.width + x;
      return grid.cells[i] ? counts[i] || "#" : ".";
    }).join(""),
  );
};

describe("stepGroups", () => {
  test("neighbouring steps of the same length share a group", () => {
    // Down the stair: three 2-steps, a 1-step, a lone 2-step; the left wall and floor are single long steps.
    expect(
      showGroups(
        parse(
          "##.........",
          "####.......",
          "######.....",
          "#######....",
          "#########..",
          "###########",
        ),
      ),
    ).toEqual([
      "13.........",
      "1#33.......",
      "1###33.....",
      "1#####1....",
      "1######11..",
      "11111111111",
    ]);
  });

  test("a hexagon's diagonals group their 2-steps in twos and threes", () => {
    const grid = trim(polygon.build(resolveValues(polygon.params, { sides: 6, diameter: 61 })));
    const labels = highlight(grid, "groups")!.legend.map(l => l.label);
    expect(labels).toContain("2×2");
    expect(labels).toContain("2×3");
  });

  test("a 45° diamond is one long group of 1-steps", () => {
    const grid = parse("..#..", ".###.", "#####", ".###.", "..#..");
    const counts = stepGroups(grid);
    const ring = hollow(grid, 1);
    for (let i = 0; i < counts.length; i++) expect(counts[i]).toBe(ring.cells[i] ? 8 : 0);
  });
});
