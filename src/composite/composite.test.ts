import { describe, expect, test } from "bun:test";
import { countBlocks, type Grid } from "../shapes/grid";
import type { Point } from "../shapes/raster";
import {
  centredPosition,
  duplicateLayer,
  EMPTY_COMPOSITE,
  eraserCells,
  flatten,
  isOffCanvas,
  layerGrid,
  lineEndpoints,
  newEraserLayer,
  newLineLayer,
  newShapeLayer,
  nextLayerName,
  paintEraser,
  resizeCanvas,
  setLineEndpoints,
  shapeGrid,
  type Composite,
  type Layer,
} from "./composite";
import { brushCells, rasterLine, rectCells, snapLine } from "./draw";

/** Rows of `#` (block) and `.` (air). */
const show = (grid: Grid) =>
  Array.from({ length: grid.height }, (_, y) =>
    Array.from({ length: grid.width }, (_, x) => (grid.cells[y * grid.width + x] ? "#" : ".")).join(""),
  );

const keys = (points: readonly Point[]) => points.map(p => `${p.x},${p.y}`).sort();

const small = (layers: Layer[], width = 16, height = 16): Composite => ({ canvas: { width, height }, layers });

const rect = (x: number, y: number, width: number, height: number, extra = {}): Layer => ({
  kind: "shape",
  id: `r${x},${y}`,
  name: "Rectangle",
  visible: true,
  x,
  y,
  shapeId: "rectangle",
  values: { width, height, radius: 0, ...extra },
});

const line = (a: Point, b: Point): Layer => newLineLayer(EMPTY_COMPOSITE, a, b);
const eraser = (cells: Point[], canvas = { width: 16, height: 16 }): Layer =>
  newEraserLayer({ canvas, layers: [] }, cells);

describe("rasterLine", () => {
  test("is thin and 8-connected, one cell per step", () => {
    const cells = rasterLine({ x: 0, y: 0 }, { x: 5, y: 2 });
    expect(cells).toHaveLength(6);
    for (let i = 1; i < cells.length; i++) {
      expect(Math.abs(cells[i]!.x - cells[i - 1]!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(cells[i]!.y - cells[i - 1]!.y)).toBeLessThanOrEqual(1);
    }
  });

  test("draws the same cells whichever way round the endpoints are", () => {
    for (let x = -6; x <= 6; x++) {
      for (let y = -6; y <= 6; y++) {
        const a = { x: 0, y: 0 }, b = { x, y };
        expect(keys(rasterLine(b, a))).toEqual(keys(rasterLine(a, b)));
      }
    }
  });

  test("a = b is one cell", () => {
    expect(rasterLine({ x: 3, y: 4 }, { x: 3, y: 4 })).toEqual([{ x: 3, y: 4 }]);
  });
});

describe("snapLine", () => {
  const o = { x: 0, y: 0 };
  test("snaps to horizontal, vertical and 45°", () => {
    expect(snapLine(o, { x: 10, y: 2 })).toEqual({ x: 10, y: 0 });
    expect(snapLine(o, { x: -1, y: -9 })).toEqual({ x: 0, y: -9 });
    expect(snapLine(o, { x: 7, y: -5 })).toEqual({ x: 7, y: -7 });
    expect(snapLine(o, { x: -4, y: 6 })).toEqual({ x: -6, y: 6 });
    expect(snapLine(o, { x: -10, y: 1 })).toEqual({ x: -10, y: 0 });
  });
});

describe("brushCells", () => {
  test("a size-3 brush covers 3×3 around the cell", () => {
    expect(keys(brushCells([{ x: 5, y: 5 }], 3))).toEqual(keys(rectCells({ x: 4, y: 4 }, { x: 6, y: 6 })));
  });

  test("an even brush leans up and left", () => {
    expect(keys(brushCells([{ x: 5, y: 5 }], 2))).toEqual(keys(rectCells({ x: 5, y: 5 }, { x: 6, y: 6 })));
  });

  test("joins far-apart samples without gaps or repeats", () => {
    const cells = brushCells([{ x: 0, y: 0 }, { x: 10, y: 0 }], 1);
    expect(keys(cells)).toEqual(keys(rectCells({ x: 0, y: 0 }, { x: 10, y: 0 })));
  });
});

describe("shape layers", () => {
  test("carry their own Fill, worked out on the shape alone", () => {
    expect(countBlocks(shapeGrid("rectangle", { width: 5, height: 4 }))).toBe(20);
    expect(countBlocks(shapeGrid("rectangle", { width: 5, height: 4, fill: "hollow", thickness: 1 }))).toBe(14);
  });

  test("an outline can sit on a solid shape", () => {
    const { grid } = flatten(small([rect(0, 0, 6, 6), rect(2, 2, 6, 6, { fill: "hollow", thickness: 1 })]));
    expect(grid.width).toBe(8);
    // The outline's top row and left column overlap the solid square in 7 cells.
    expect(countBlocks(grid)).toBe(36 + 20 - 7);
    expect(show(grid)[4]).toBe("######.#");
  });

  test("a new shape starts centred, rounded down", () => {
    expect(centredPosition(shapeGrid("rectangle", { width: 5, height: 4 }), { width: 16, height: 16 })).toEqual({
      x: 5,
      y: 6,
    });
    const layer = newShapeLayer(small([]), "circle", { diameter: 15 });
    expect([layer.x, layer.y, layer.name]).toEqual([0, 0, "Circle 1"]);
  });
});

describe("flatten", () => {
  test("an empty composite is an empty plan", () => {
    expect(flatten(EMPTY_COMPOSITE).grid.width).toBe(0);
  });

  test("trims to the blocks and reports where they start", () => {
    const { grid, origin } = flatten(small([rect(3, 5, 2, 2)]));
    expect(show(grid)).toEqual(["##", "##"]);
    expect(origin).toEqual({ x: 3, y: 5 });
  });

  test("an eraser removes blocks only from the layers below it", () => {
    const hole = eraser([{ x: 1, y: 1 }]);
    expect(show(flatten(small([rect(0, 0, 3, 3), hole])).grid)).toEqual(["###", "#.#", "###"]);
    expect(show(flatten(small([hole, rect(0, 0, 3, 3)])).grid)).toEqual(["###", "###", "###"]);
  });

  test("a layer above an eraser can put blocks back", () => {
    const layers = [rect(0, 0, 3, 3), eraser(rectCells({ x: 0, y: 1 }, { x: 2, y: 1 })), line({ x: 1, y: 0 }, { x: 1, y: 2 })];
    expect(show(flatten(small(layers)).grid)).toEqual(["###", ".#.", "###"]);
  });

  test("hidden layers drop out entirely", () => {
    const hole = { ...eraser([{ x: 1, y: 1 }]), visible: false };
    expect(countBlocks(flatten(small([rect(0, 0, 3, 3), hole])).grid)).toBe(9);
    expect(flatten(small([{ ...rect(0, 0, 3, 3), visible: false }])).grid.width).toBe(0);
  });

  test("blocks off the canvas are cut off, with negative positions allowed", () => {
    const { grid, origin } = flatten(small([rect(-2, -1, 4, 4), rect(14, 14, 5, 5)]));
    expect(origin).toEqual({ x: 0, y: 0 });
    expect(grid.width).toBe(16);
    expect(countBlocks(grid)).toBe(2 * 3 + 2 * 2);
  });

  test("lines are clipped like any other layer", () => {
    expect(countBlocks(flatten(small([line({ x: -5, y: 3 }, { x: 20, y: 3 })])).grid)).toBe(16);
  });
});

describe("canvas", () => {
  test("defaults to 128×128 and clamps resizes into 8–256", () => {
    expect(EMPTY_COMPOSITE.canvas).toEqual({ width: 128, height: 128 });
    expect(resizeCanvas(EMPTY_COMPOSITE, { width: 2, height: 999 }).canvas).toEqual({ width: 8, height: 256 });
  });

  test("shrinking cuts blocks off, growing again brings them back", () => {
    const composite = small([rect(10, 0, 4, 4)]);
    const shrunk = resizeCanvas(composite, { width: 8, height: 16 });
    expect(flatten(shrunk).grid.width).toBe(0);
    expect(isOffCanvas(shrunk.layers[0]!, shrunk.canvas)).toBe(true);
    const grown = resizeCanvas(shrunk, { width: 16, height: 16 });
    expect(countBlocks(flatten(grown).grid)).toBe(16);
    expect(isOffCanvas(grown.layers[0]!, grown.canvas)).toBe(false);
  });
});

describe("line layers", () => {
  test("store endpoints relative to their top-left position", () => {
    const layer = newLineLayer(EMPTY_COMPOSITE, { x: 9, y: 2 }, { x: 4, y: 6 });
    expect([layer.x, layer.y, layer.a, layer.b]).toEqual([4, 2, { x: 5, y: 0 }, { x: 0, y: 4 }]);
    expect(lineEndpoints(layer)).toEqual([{ x: 9, y: 2 }, { x: 4, y: 6 }]);
  });

  test("moving an endpoint up and left moves the position, not the other endpoint", () => {
    const layer = newLineLayer(EMPTY_COMPOSITE, { x: 5, y: 5 }, { x: 8, y: 5 });
    const moved = setLineEndpoints(layer, { x: 2, y: 1 }, lineEndpoints(layer)[1]);
    expect([moved.x, moved.y]).toEqual([2, 1]);
    expect(lineEndpoints(moved)[1]).toEqual({ x: 8, y: 5 });
  });

  test("moving the layer doesn't change its shape", () => {
    const layer = newLineLayer(EMPTY_COMPOSITE, { x: 0, y: 0 }, { x: 7, y: 3 });
    expect(show(layerGrid({ ...layer, x: 40, y: -3 }))).toEqual(show(layerGrid(layer)));
  });
});

describe("eraser layers", () => {
  const canvas = { width: 16, height: 16 };

  test("store painted cells relative to their top-left, clipped to the canvas", () => {
    const layer = newEraserLayer(small([]), rectCells({ x: -2, y: 3 }, { x: 1, y: 4 }));
    expect([layer.x, layer.y]).toEqual([0, 3]);
    expect(keys(eraserCells(layer))).toEqual(keys(rectCells({ x: 0, y: 3 }, { x: 1, y: 4 })));
  });

  test("more strokes add to the layer without moving what's there", () => {
    const first = newEraserLayer(small([]), [{ x: 5, y: 5 }]);
    const more = paintEraser(first, [{ x: 2, y: 8 }, { x: 5, y: 5 }], canvas);
    expect([more.x, more.y]).toEqual([2, 5]);
    expect(keys(eraserCells(more))).toEqual(keys([{ x: 5, y: 5 }, { x: 2, y: 8 }]));
  });

  test("restore takes cells back out, and an emptied layer is kept", () => {
    const layer = newEraserLayer(small([]), rectCells({ x: 1, y: 1 }, { x: 3, y: 1 }));
    const restored = paintEraser(layer, [{ x: 1, y: 1 }], canvas, true);
    expect([restored.x, restored.y]).toEqual([2, 1]);
    const empty = paintEraser(restored, rectCells({ x: 0, y: 0 }, { x: 5, y: 5 }), canvas, true);
    expect(empty.cells).toEqual([]);
    expect([empty.x, empty.y]).toEqual([2, 1]);
  });

  test("keeps cells where nothing is below yet", () => {
    const hole = eraser([{ x: 10, y: 10 }]);
    expect(flatten(small([hole])).grid.width).toBe(0);
    expect(countBlocks(flatten(small([rect(8, 8, 4, 4), hole])).grid)).toBe(15);
  });

  test("handles a canvas-sized eraser", () => {
    const big = { width: 256, height: 256 };
    const layer = newEraserLayer({ canvas: big, layers: [] }, rectCells({ x: 0, y: 0 }, { x: 255, y: 255 }));
    expect(layer.cells).toHaveLength(256 * 256);
    expect(flatten({ canvas: big, layers: [rect(0, 0, 256, 256), layer] }).grid.width).toBe(0);
  });
});

describe("names", () => {
  test("auto-names take the next free number", () => {
    const layers = [{ ...rect(0, 0, 1, 1), name: "Circle 1" }, { ...rect(0, 0, 1, 1), name: "Circle 3" }];
    expect(nextLayerName(layers, "Circle")).toBe("Circle 2");
    expect(nextLayerName(layers, "Line")).toBe("Line 1");
  });

  test("duplicating gives a new id and name at the same position", () => {
    const original = { ...rect(4, 4, 2, 2), name: "Rectangle 1" };
    const copy = duplicateLayer(small([original]), original);
    expect(copy.id).not.toBe(original.id);
    expect([copy.name, copy.x, copy.y]).toEqual(["Rectangle 2", 4, 4]);
  });
});
