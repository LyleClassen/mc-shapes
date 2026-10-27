import { describe, expect, test } from "bun:test";
import { countBlocks, gridFrom, type Grid } from "../shapes/grid";
import { EMPTY_COMPOSITE, flatten, layerGrid, newImageLayer } from "./composite";
import { layerCentre, placeCentre, resizeImageLayer } from "./edit";
import { decodeMask, encodeMask, imageGrid, inkGrid, MASK_MAX, thin, traceSize } from "./image";

/** Rows of `#` (block) and `.` (air). */
const show = (grid: Grid) =>
  Array.from({ length: grid.height }, (_, y) =>
    Array.from({ length: grid.width }, (_, x) => (grid.cells[y * grid.width + x] ? "#" : ".")).join(""),
  );

const rows = (lines: string[]): Grid =>
  gridFrom(lines[0]!.length, lines.length, (cx, cy) => lines[Math.floor(cy)]![Math.floor(cx)] === "#");

/** An RGBA picture: `ink` pixels get `fg`, the rest `bg`. */
function picture(width: number, height: number, ink: (x: number, y: number) => boolean, fg: number[], bg: number[]) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) rgba.set(ink(x, y) ? fg : bg, (y * width + x) * 4);
  }
  return rgba;
}

const BLACK = [0, 0, 0, 255], WHITE = [255, 255, 255, 255], CLEAR = [0, 0, 0, 0];

/** A ring `thickness` px wide around (cx, cy). */
const ring = (cx: number, cy: number, r: number, thickness: number) => (x: number, y: number) => {
  const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
  return d <= r && d > r - thickness;
};

const ringMask = () => {
  const rgba = picture(200, 200, ring(100, 100, 90, 6), BLACK, CLEAR);
  return encodeMask(inkGrid(rgba, 200, 200)!, "ring");
};

/** Every block has at least one 8-connected neighbour, and no 2×2 square is solid. */
function isThinLine(grid: Grid) {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < grid.width && y < grid.height && grid.cells[y * grid.width + x] === 1;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (!at(x, y)) continue;
      if (at(x + 1, y) && at(x, y + 1) && at(x + 1, y + 1)) return false;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(x + dx, y + dy)) n++;
      if (!n) return false;
    }
  }
  return true;
}

describe("inkGrid", () => {
  test("reads a see-through picture by alpha and crops to the ink", () => {
    const rgba = picture(10, 8, (x, y) => x >= 3 && x <= 5 && y === 4, BLACK, CLEAR);
    expect(show(inkGrid(rgba, 10, 8)!)).toEqual(["###"]);
  });

  test("reads dark ink on an opaque light background", () => {
    const rgba = picture(6, 6, (x, y) => x === 2 && y >= 1 && y <= 3, BLACK, WHITE);
    expect(show(inkGrid(rgba, 6, 6)!)).toEqual(["#", "#", "#"]);
  });

  test("reads light ink on an opaque dark background", () => {
    const rgba = picture(6, 6, (x, y) => y === 2 && x >= 1 && x <= 2, WHITE, BLACK);
    expect(show(inkGrid(rgba, 6, 6)!)).toEqual(["##"]);
  });

  test("is null for a blank picture", () => {
    expect(inkGrid(picture(5, 5, () => false, BLACK, CLEAR), 5, 5)).toBeNull();
  });

  test("shrinks big pictures to MASK_MAX, keeping one-pixel lines", () => {
    const w = 1500, h = 300;
    const rgba = picture(w, h, (x, y) => x === 0 || x === w - 1 || y === 0 || y === h - 1 || y === 150, BLACK, CLEAR);
    const grid = inkGrid(rgba, w, h)!;
    // Shrunk by whole steps of 3, the smallest that fits.
    expect(grid.width).toBeLessThanOrEqual(MASK_MAX);
    expect([grid.width, grid.height]).toEqual([500, 100]);
    // The middle line is still unbroken.
    const row = Math.floor(150 / 3);
    expect(Array.from({ length: grid.width }, (_, x) => grid.cells[row * grid.width + x]).every(Boolean)).toBe(true);
  });
});

test("masks survive encoding", () => {
  const grid = gridFrom(13, 7, (cx, cy) => (Math.floor(cx) * 3 + Math.floor(cy)) % 4 === 0);
  const mask = encodeMask(grid, "round-trip");
  expect(show(decodeMask(mask))).toEqual(show(grid));
});

describe("thin", () => {
  test("shrinks a thick bar to a one-wide line", () => {
    const bar = gridFrom(12, 5, (cx, cy) => cx > 1 && cx < 11 && cy > 1 && cy < 4);
    const out = thin(bar);
    expect(isThinLine(out)).toBe(true);
    expect(countBlocks(out)).toBeGreaterThan(4);
  });

  test("drops the inside corner of an L step", () => {
    expect(show(thin(rows(["#....", "#....", "#####"])))).toEqual(["#....", "#....", ".####"]);
  });
});

describe("imageGrid", () => {
  test("lines trace a thick ring to a thin, closed ring at the chosen width", () => {
    const grid = imageGrid(ringMask(), { size: 40, trace: "lines" });
    expect(grid.width).toBeGreaterThanOrEqual(38);
    expect(grid.width).toBeLessThanOrEqual(40);
    expect(isThinLine(grid)).toBe(true);
    // Closed: the middle is cut off from the outside.
    const mid = Math.floor(grid.height / 2) * grid.width + Math.floor(grid.width / 2);
    expect(grid.cells[mid]).toBe(0);
  });

  test("the height follows the picture's shape", () => {
    const rgba = picture(200, 100, (x, y) => x === 0 || x === 199 || y === 0 || y === 99, BLACK, CLEAR);
    const mask = encodeMask(inkGrid(rgba, 200, 100)!, "wide");
    expect(traceSize(mask, 40)).toEqual({ width: 40, height: 20 });
    const grid = imageGrid(mask, { size: 40, trace: "lines" });
    expect([grid.width, grid.height]).toEqual([40, 20]);
  });

  test("a silhouette fills the ring solid, or keeps its border as an outline", () => {
    const mask = ringMask();
    const solid = imageGrid(mask, { size: 30, trace: "silhouette", fill: "solid" });
    const outline = imageGrid(mask, { size: 30, trace: "silhouette", fill: "hollow", thickness: 1 });
    const mid = Math.floor(solid.height / 2) * solid.width + Math.floor(solid.width / 2);
    expect(solid.cells[mid]).toBe(1);
    expect(outline.cells[mid]).toBe(0);
    expect(countBlocks(outline)).toBeLessThan(countBlocks(solid));
    expect(countBlocks(outline)).toBeGreaterThan(60);
  });
});

test("close gaps fills a silhouette whose outline has an opening", () => {
  const open = (x: number, y: number) => ring(100, 100, 90, 6)(x, y) && !(x > 90 && x < 110 && y < 50);
  const mask = encodeMask(inkGrid(picture(200, 200, open, BLACK, CLEAR), 200, 200)!, "open-ring");
  const centre = (g: Grid) => g.cells[Math.floor(g.height / 2) * g.width + Math.floor(g.width / 2)];
  expect(centre(imageGrid(mask, { size: 30, trace: "silhouette", fill: "solid", closeGaps: 0 }))).toBe(0);
  expect(centre(imageGrid(mask, { size: 30, trace: "silhouette", fill: "solid", closeGaps: 2 }))).toBe(1);
});

describe("image layers", () => {
  test("start centred, named after the file, and flatten", () => {
    const composite = { canvas: { width: 64, height: 64 }, layers: [] };
    const layer = newImageLayer(composite, ringMask(), "emblem.png");
    expect(layer.name).toBe("emblem 1");
    const grid = layerGrid(layer);
    expect(layer.x).toBe(Math.floor((64 - grid.width) / 2));
    expect(countBlocks(flatten({ ...composite, layers: [layer] }).grid)).toBe(countBlocks(grid));
  });

  test("start no wider than the canvas", () => {
    const layer = newImageLayer({ ...EMPTY_COMPOSITE, canvas: { width: 32, height: 32 } }, ringMask());
    expect(layer.values.size).toBe(32);
    expect(layer.name).toBe("Image 1");
  });

  test("resize around their centre", () => {
    const layer = placeCentre(newImageLayer(EMPTY_COMPOSITE, ringMask()), { x: 50, y: 70 });
    expect(layerCentre(layer)).toEqual({ x: 50, y: 70 });
    for (const size of [17, 40, 9, 64]) {
      const resized = resizeImageLayer(layer, { ...layer.values, size });
      expect(layerCentre(resized)).toEqual({ x: 50, y: 70 });
    }
  });
});
