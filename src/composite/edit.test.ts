import { describe, expect, test } from "bun:test";
import type { Point } from "../shapes/raster";
import { newEraserLayer, newLineLayer, type Composite, type Layer } from "./composite";
import {
  centreLayer,
  describeLayer,
  fitCanvas,
  insertLayer,
  layerBox,
  moveLayer,
  neighbourOf,
  pickLayer,
  reorderLayer,
} from "./edit";
import {
  EMPTY_HISTORY,
  HISTORY_LIMIT,
  record,
  redo,
  sameComposite,
  seal,
  selectionAfter,
  undo,
  type History,
} from "./history";

const canvas = { width: 16, height: 16 };
const small = (layers: Layer[]): Composite => ({ canvas, layers });

const rect = (id: string, x: number, y: number, width: number, height: number, extra = {}): Layer => ({
  kind: "shape",
  id,
  name: id,
  visible: true,
  x,
  y,
  shapeId: "rectangle",
  values: { width, height, radius: 0, ...extra },
});

const line = (id: string, a: Point, b: Point): Layer => ({ ...newLineLayer(small([]), a, b), id });
const eraser = (id: string, cells: Point[]): Layer => ({ ...newEraserLayer(small([]), cells), id });
const ids = (c: Composite) => c.layers.map(l => l.id);

describe("layer order", () => {
  const c = small([rect("a", 0, 0, 2, 2), rect("b", 0, 0, 2, 2), rect("c", 0, 0, 2, 2)]);

  test("a new layer goes just above the selection, or on top", () => {
    const d = rect("d", 0, 0, 1, 1);
    expect(ids(insertLayer(c, d, "a"))).toEqual(["a", "d", "b", "c"]);
    expect(ids(insertLayer(c, d, null))).toEqual(["a", "b", "c", "d"]);
    expect(ids(insertLayer(c, d, "gone"))).toEqual(["a", "b", "c", "d"]);
  });

  test("reorder moves a layer to an index, clamped", () => {
    expect(ids(reorderLayer(c, "c", 0))).toEqual(["c", "a", "b"]);
    expect(ids(reorderLayer(c, "a", 9))).toEqual(["b", "c", "a"]);
  });

  test("after a delete, the layer below is selected, or above for the bottom one", () => {
    expect(neighbourOf(c, "b")).toBe("a");
    expect(neighbourOf(c, "a")).toBe("b");
    expect(neighbourOf(small([rect("a", 0, 0, 1, 1)]), "a")).toBeNull();
  });
});

describe("moving and centring", () => {
  test("moving to the same place keeps the same layer", () => {
    const r = rect("a", 3, 4, 2, 2);
    expect(moveLayer(r, 3, 4)).toBe(r);
    expect(moveLayer(r, 5, 4)).toMatchObject({ x: 5, y: 4 });
  });

  test("centres the blocks along one axis or both, rounding down", () => {
    const r = rect("a", 0, 1, 5, 4);
    expect(centreLayer(r, canvas, true, true)).toMatchObject({ x: 5, y: 6 });
    expect(centreLayer(r, canvas, true, false)).toMatchObject({ x: 5, y: 1 });
    expect(centreLayer(r, canvas, false, true)).toMatchObject({ x: 0, y: 6 });
  });

  test("centring a line centres its blocks", () => {
    const l = line("l", { x: 0, y: 0 }, { x: 3, y: 0 });
    expect(centreLayer(l, canvas, true, true)).toMatchObject({ x: 6, y: 7 });
    expect(layerBox(l)).toEqual({ x: 0, y: 0, width: 4, height: 1 });
  });
});

describe("fitCanvas", () => {
  const pos = (l: Layer) => [l.x, l.y];

  test("sizes the canvas to every layer and moves them to its top-left, hidden ones included", () => {
    const fit = fitCanvas(small([rect("a", -5, -3, 4, 4), { ...rect("b", 14, 10, 6, 2), visible: false }]));
    expect(fit.canvas).toEqual({ width: 25, height: 15 });
    expect(fit.layers.map(pos)).toEqual([[0, 0], [19, 13]]);
  });

  test("erasers move along but don't count towards the size", () => {
    const fit = fitCanvas(small([rect("a", 2, 2, 10, 10), eraser("e", [{ x: 14, y: 14 }])]));
    expect(fit.canvas).toEqual({ width: 10, height: 10 });
    expect(fit.layers.map(pos)).toEqual([[0, 0], [12, 12]]);
  });

  test("a layer smaller than the minimum canvas is centred on it", () => {
    const fit = fitCanvas(small([rect("a", 5, 5, 3, 2)]));
    expect(fit.canvas).toEqual({ width: 8, height: 8 });
    expect(fit.layers.map(pos)).toEqual([[2, 3]]);
  });

  test("nothing to fit leaves it alone", () => {
    const c = small([eraser("e", [{ x: 1, y: 1 }])]);
    expect(fitCanvas(c)).toBe(c);
    expect(fitCanvas(small([]))).toEqual(small([]));
  });
});

describe("pickLayer", () => {
  // A ring with a rectangle under its hole, and a line on top crossing a corner.
  const ring = rect("ring", 0, 0, 8, 8, { fill: "hollow", thickness: 1 });
  const under = rect("under", 2, 2, 4, 4);
  const top = line("top", { x: 10, y: 0 }, { x: 14, y: 4 });

  test("picks the topmost layer with a block under the cursor", () => {
    expect(pickLayer(small([under, ring]), { x: 3, y: 3 })?.id).toBe("under");
    expect(pickLayer(small([under, ring]), { x: 0, y: 3 })?.id).toBe("ring");
  });

  test("falls back to the topmost bounding box", () => {
    expect(pickLayer(small([ring, top]), { x: 4, y: 4 })?.id).toBe("ring");
    expect(pickLayer(small([ring, top]), { x: 11, y: 3 })?.id).toBe("top");
    expect(pickLayer(small([ring]), { x: 12, y: 12 })).toBeNull();
  });

  test("skips hidden layers", () => {
    expect(pickLayer(small([ring, { ...under, visible: false }]), { x: 3, y: 3 })?.id).toBe("ring");
  });

  test("an eraser is picked by its painted cells", () => {
    const e = eraser("e", [{ x: 3, y: 3 }]);
    expect(pickLayer(small([under, e]), { x: 3, y: 3 })?.id).toBe("e");
  });
});

describe("describeLayer", () => {
  test("summarises each kind in a line", () => {
    expect(describeLayer(rect("a", 0, 0, 5, 3, { fill: "hollow" }))).toBe("Rectangle · 5 × 3 · outline");
    expect(describeLayer(line("l", { x: 1, y: 2 }, { x: 6, y: 2 }))).toBe("1,2 → 6,2");
    expect(describeLayer(eraser("e", [{ x: 0, y: 0 }]))).toBe("1 cell");
  });
});

describe("history", () => {
  const c0 = small([rect("a", 0, 0, 2, 2)]);
  const c1 = small([rect("a", 1, 0, 2, 2)]);
  const c2 = small([rect("a", 2, 0, 2, 2)]);
  const c3 = small([rect("a", 3, 0, 2, 2)]);

  test("records a step and undoes and redoes it", () => {
    const h = record(EMPTY_HISTORY, c0, c1, "a");
    const back = undo(h)!;
    expect(back.composite).toBe(c0);
    expect(back.step.affected).toBe("a");
    const fwd = redo(back.history)!;
    expect(fwd.composite).toBe(c1);
    expect(fwd.history.past).toHaveLength(1);
    expect(undo(EMPTY_HISTORY)).toBeNull();
    expect(redo(h)).toBeNull();
  });

  test("a change that leaves the composite as it was records nothing", () => {
    const copy = small([rect("a", 0, 0, 2, 2)]);
    expect(sameComposite(c0, copy)).toBe(true);
    expect(record(EMPTY_HISTORY, c0, copy, "a").past).toHaveLength(0);
  });

  test("edits to the same field merge until something else is touched", () => {
    let h = record(EMPTY_HISTORY, c0, c1, "a", "a:x");
    h = record(h, c1, c2, "a", "a:x");
    expect(h.past).toHaveLength(1);
    expect(undo(h)!.composite).toBe(c0);

    expect(record(h, c2, c3, "a", "a:y").past).toHaveLength(2);
    expect(record(seal(h), c2, c3, "a", "a:x").past).toHaveLength(2);
    expect(record(undo(h)!.history, c0, c1, "a", "a:x").past).toHaveLength(1);
  });

  test("typing a field back to where it started drops the step", () => {
    let h = record(EMPTY_HISTORY, c2, c3, "a");
    h = record(h, c3, c1, "a", "a:x");
    h = record(h, c1, c3, "a", "a:x");
    expect(h.past).toHaveLength(1);
    expect(h.merge).toBeNull();
  });

  test("a new edit after undo clears redo", () => {
    const h = undo(record(EMPTY_HISTORY, c0, c1, "a"))!.history;
    expect(h.future).toHaveLength(1);
    expect(record(h, c0, c2, "a").future).toHaveLength(0);
  });

  test(`keeps the last ${HISTORY_LIMIT} steps`, () => {
    let h: History = EMPTY_HISTORY;
    let c = c0;
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) {
      const next = small([rect("a", i, 0, 2, 2)]);
      h = record(h, c, next, "a");
      c = next;
    }
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]!.before.layers[0]!.x).toBe(5);
  });
});

describe("selectionAfter", () => {
  const a = rect("a", 0, 0, 1, 1), b = rect("b", 0, 0, 1, 1), c = rect("c", 0, 0, 1, 1);

  test("selects the affected layer when it's there", () => {
    expect(selectionAfter("b", small([a, b]), small([a, b]), null)).toBe("b");
  });

  test("selects the layer below a vanished one, or nothing", () => {
    expect(selectionAfter("c", small([a, b, c]), small([a, b]), "c")).toBe("b");
    expect(selectionAfter("a", small([a]), small([]), "a")).toBeNull();
  });

  test("keeps the selection for steps on several layers or none", () => {
    expect(selectionAfter(null, small([a, b]), small([b, a]), "a")).toBe("a");
  });
});
