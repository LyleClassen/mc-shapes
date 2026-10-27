import { applyFill, fillParams } from "../shapes/fill";
import { EMPTY_GRID, gridFrom, trim, type Grid } from "../shapes/grid";
import { outsideAir } from "../shapes/patterns";
import { centreParam, centreParity, mirrorGrid, NO_AXES, type Axes } from "../shapes/symmetry";
import { resolveValues, type ParamDef, type ParamValues } from "../shapes/types";
import type { Point } from "../shapes/raster";
import { rasterLine } from "./draw";

/** Longest side of a stored mask. Big enough for 256-block traces, small enough for sessionStorage. */
export const MASK_MAX = 1024;

/**
 * An imported picture's ink, cropped to its drawn part: 1 bit per pixel,
 * packed row-major and base64-encoded so it can live in the composite.
 * `id` is fixed at import and keys the trace caches.
 */
export interface ImageMask {
  id: string;
  width: number;
  height: number;
  bits: string;
}

export const imageParams: readonly ParamDef[] = [
  {
    ...centreParam,
    hint: v =>
      v.centre === "free"
        ? "Any size; the trace follows the picture as drawn."
        : `${v.centre === "1x1" ? "Odd" : "Even"} sizes only, and the trace is mirrored so a symmetric picture stays exactly symmetric.`,
  },
  {
    kind: "number",
    key: "size",
    label: "Size",
    min: 8,
    max: 1024,
    default: 64,
    unit: "blocks wide",
    parity: centreParity,
    hint: "The height follows the picture's shape. Resizing keeps the centre where it is.",
  },
  {
    kind: "select",
    key: "trace",
    label: "Trace",
    options: [
      { value: "lines", label: "Lines" },
      { value: "silhouette", label: "Silhouette" },
    ],
    default: "lines",
    hint: v =>
      v.trace === "silhouette"
        ? "Fills the outer shape; inner lines are ignored. Outline keeps only its border."
        : "Follows every drawn line, one block wide.",
  },
  {
    kind: "number",
    key: "closeGaps",
    label: "Close gaps",
    min: 0,
    max: 12,
    default: 0,
    unit: "blocks",
    hint: "Bridges openings up to twice this wide, so a drawing that isn't fully closed still fills.",
    visible: v => v.trace === "silhouette",
  },
  {
    kind: "number",
    key: "detail",
    label: "Detail",
    min: 0,
    max: 10,
    default: 5,
    hint: "Lower straightens lines more; higher keeps smaller corners and notches.",
  },
];

/** What a new image layer starts with: lines, plus a 1-thick outline ready for Silhouette. */
export const DEFAULT_IMAGE_VALUES: ParamValues = {
  centre: "free",
  size: 64,
  trace: "lines",
  closeGaps: 0,
  detail: 5,
  fill: "hollow",
  thickness: 1,
};

/**
 * The drawn part of an RGBA picture, or null when nothing is drawn. A picture
 * with a see-through background is read by its alpha; an opaque one by
 * whichever of dark or light is the minority, so dark lines on white and
 * light lines on black both work. Cropped to the ink, then shrunk to at most
 * MASK_MAX a side, keeping a pixel when any pixel it covers is ink so thin
 * lines survive.
 */
export function inkGrid(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Grid | null {
  const n = width * height;
  let clear = 0, lum = 0;
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3]! < 128) clear++;
    lum += luminance(rgba, i);
  }
  const byAlpha = clear > n * 0.01;
  const darkInk = lum / n >= 128;
  const isInk = (i: number) => {
    if (byAlpha) return rgba[i * 4 + 3]! > 64;
    if (rgba[i * 4 + 3]! < 128) return false;
    return darkInk ? luminance(rgba, i) < 128 : luminance(rgba, i) >= 128;
  };

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isInk(y * width + x)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;

  const cropW = maxX - minX + 1, cropH = maxY - minY + 1;
  const step = Math.max(1, Math.ceil(Math.max(cropW, cropH) / MASK_MAX));
  const outW = Math.ceil(cropW / step), outH = Math.ceil(cropH / step);
  const cells = new Uint8Array(outW * outH);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      if (isInk((y + minY) * width + x + minX)) cells[Math.floor(y / step) * outW + Math.floor(x / step)] = 1;
    }
  }
  return { width: outW, height: outH, cells };
}

const luminance = (rgba: Uint8ClampedArray | Uint8Array, i: number) =>
  0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;

export function encodeMask(grid: Grid, id: string = crypto.randomUUID()): ImageMask {
  const bytes = new Uint8Array(Math.ceil(grid.cells.length / 8));
  grid.cells.forEach((c, i) => {
    if (c) bytes[i >> 3]! |= 0x80 >> (i & 7);
  });
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return { id, width: grid.width, height: grid.height, bits: btoa(binary) };
}

const DECODED_CACHE_SIZE = 8;
const decoded = new Map<string, Grid>();
const skeletonPaths = new Map<string, Point[][]>();
const contours = new Map<string, Point[][]>();
const symmetries = new Map<string, Axes>();

/** Keeps a small per-mask cache, dropping the oldest entry. */
function remember<T>(cache: Map<string, T>, key: string, make: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit;
  const grid = make();
  cache.set(key, grid);
  if (cache.size > DECODED_CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return grid;
}

export function decodeMask(mask: ImageMask): Grid {
  return remember(decoded, mask.id, () => {
    const binary = atob(mask.bits);
    const cells = new Uint8Array(mask.width * mask.height);
    for (let i = 0; i < cells.length; i++) cells[i] = (binary.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
    return { width: mask.width, height: mask.height, cells };
  });
}

/** Share of ink that must find ink at its mirrored spot for a picture to count as symmetric that way. */
const SYMMETRY_MATCH = 0.9;

/**
 * Which ways the picture is (roughly) mirror-symmetric. Hand drawings are
 * never exact, so a pixel matches when its mirror image lands within about 1%
 * of the picture's size of some ink.
 */
export function maskSymmetry(mask: ImageMask): Axes {
  return remember(symmetries, mask.id, () => {
    const grid = decodeMask(mask);
    const { width: w, height: h, cells } = grid;
    const near = spread(grid, Math.max(1, Math.round(Math.max(w, h) / 100))).cells;
    let ink = 0, x = 0, y = 0;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (!cells[r * w + c]) continue;
        ink++;
        x += near[r * w + w - 1 - c]!;
        y += near[(h - 1 - r) * w + c]!;
      }
    }
    return ink ? { x: x >= ink * SYMMETRY_MATCH, y: y >= ink * SYMMETRY_MATCH } : NO_AXES;
  });
}

/** The centre type a new layer of this picture starts with: one matching `size` when the picture is symmetric. */
export function detectCentre(mask: ImageMask, size: number): string {
  const axes = maskSymmetry(mask);
  if (!axes.x && !axes.y) return "free";
  return size % 2 ? "1x1" : "2x2";
}

/**
 * Block width and height for a trace `size` blocks wide. With a centre type,
 * the height keeps the same parity as the width when the picture mirrors top
 * to bottom, so both axes centre alike.
 */
export function traceSize(mask: ImageMask, size: number, centre = "free"): { width: number; height: number } {
  const exact = (mask.height * size) / mask.width;
  let height = Math.round(exact);
  if (centre !== "free" && maskSymmetry(mask).y && (height - size) % 2) height = height < exact ? height + 1 : height - 1;
  return { width: size, height: Math.max(1, height) };
}

const TRACE_CACHE_SIZE = 32;
const traceCache = new Map<string, Grid>();

/**
 * The picture traced into blocks at the layer's size, trimmed. Cached by mask
 * and values like `shapeGrid`, since dragging re-flattens on every move.
 * Callers must not mutate the grid.
 */
export function imageGrid(mask: ImageMask, values: ParamValues): Grid {
  const { centre, size, trace, closeGaps, detail } = resolveValues(imageParams, values);
  const fill = resolveValues(fillParams, values);
  const key = JSON.stringify([mask.id, centre, size, trace, detail, trace === "silhouette" ? [closeGaps, fill] : null]);
  const cached = traceCache.get(key);
  if (cached) {
    traceCache.delete(key);
    traceCache.set(key, cached);
    return cached;
  }
  const blocks = traceSize(mask, Number(size), String(centre));
  // With a centre type, a symmetric picture is traced from one half and mirrored, so rounding can't skew it.
  const axes = centre === "free" ? NO_AXES : maskSymmetry(mask);
  // Corners shallower than this are straightened away; never under a pixel, so pixel noise always goes.
  const tolerance = Math.max(1, ((10 - Number(detail)) / 10) * (mask.width / blocks.width));
  const grid =
    trace === "silhouette"
      ? trim(applyFill(trim(mirrorGrid(traceSilhouette(mask, blocks, tolerance, Number(closeGaps)), axes)), fill))
      : trim(mirrorGrid(traceLines(mask, blocks, tolerance), axes));
  traceCache.set(key, grid);
  if (traceCache.size > TRACE_CACHE_SIZE) traceCache.delete(traceCache.keys().next().value!);
  return grid;
}

/**
 * Everything the outside can't reach is solid. Its outline is traced as
 * polygons, straightened to `tolerance` pixels and scaled onto the blocks; a
 * block is solid when its centre is inside, or an edge runs through it so
 * parts thinner than a block aren't missed. With `closeGaps`, openings up to
 * twice that many blocks wide are bridged before filling (a closing: grow by
 * `closeGaps`, fill from outside, shrink back).
 */
function traceSilhouette(mask: ImageMask, blocks: { width: number; height: number }, tolerance: number, closeGaps: number): Grid {
  const sx = blocks.width / mask.width, sy = blocks.height / mask.height;
  const polygons = remember(contours, mask.id, () => solidContours(decodeMask(mask))).map(loop =>
    simplify([...loop, loop[0]!], tolerance)
      .slice(0, -1)
      .map(p => ({ x: p.x * sx, y: p.y * sy })),
  );
  const cells = fillPolygons(polygons, blocks);
  const solid: Grid = { ...blocks, cells };
  if (closeGaps < 1) return solid;

  // Pad so growing never runs off the edge, then crop back.
  const pad = closeGaps;
  const padded = gridFrom(blocks.width + 2 * pad, blocks.height + 2 * pad, (cx, cy) => {
    const x = Math.floor(cx) - pad, y = Math.floor(cy) - pad;
    return x >= 0 && y >= 0 && x < blocks.width && y < blocks.height && cells[y * blocks.width + x] === 1;
  });
  const grown = spread(padded, closeGaps);
  const away = spread({ ...grown, cells: outsideAir(grown) }, closeGaps);
  return gridFrom(blocks.width, blocks.height, (cx, cy) => !away.cells[(Math.floor(cy) + pad) * padded.width + Math.floor(cx) + pad]);
}

/** Grows the cells by `r` in every direction, square-wise. */
function spread(grid: Grid, r: number): Grid {
  const { width, height } = grid;
  const across = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!grid.cells[y * width + x]) continue;
      for (let i = Math.max(0, x - r); i <= Math.min(width - 1, x + r); i++) across[y * width + i] = 1;
    }
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!across[y * width + x]) continue;
      for (let j = Math.max(0, y - r); j <= Math.min(height - 1, y + r); j++) out[j * width + x] = 1;
    }
  }
  return { width, height, cells: out };
}

/**
 * The boundaries of the solid pixels as closed loops of pixel corners, with
 * the solid side always on the right (y down), and a vertex only where the
 * boundary turns. Holes would come out as loops too, but a silhouette has
 * none.
 */
function solidContours(mask: Grid): Point[][] {
  const { width, height } = mask;
  const outside = outsideAir(mask);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && !outside[y * width + x];
  // Each corner has at most two boundary edges leaving it (two where solid pixels touch diagonally).
  const W = width + 1;
  const next = new Map<number, number[]>();
  const edge = (ax: number, ay: number, bx: number, by: number) => {
    const from = ay * W + ax, list = next.get(from);
    if (list) list.push(by * W + bx);
    else next.set(from, [by * W + bx]);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!solid(x, y)) continue;
      if (!solid(x, y - 1)) edge(x, y, x + 1, y);
      if (!solid(x + 1, y)) edge(x + 1, y, x + 1, y + 1);
      if (!solid(x, y + 1)) edge(x + 1, y + 1, x, y + 1);
      if (!solid(x - 1, y)) edge(x, y + 1, x, y);
    }
  }
  const loops: Point[][] = [];
  for (const [start, list] of next) {
    while (list.length) {
      const corners = [start];
      for (let at = list.pop()!; at !== start; ) {
        corners.push(at);
        at = next.get(at)!.pop()!;
      }
      // Keep only the corners where the direction changes.
      const loop: Point[] = [];
      for (let i = 0; i < corners.length; i++) {
        const [a, b, c] = [corners.at(i - 1)!, corners[i]!, corners[(i + 1) % corners.length]!];
        if (b - a !== c - b) loop.push({ x: b % W, y: Math.floor(b / W) });
      }
      loops.push(loop);
    }
  }
  return loops;
}

/**
 * The blocks covered by polygons in block coordinates, solid on the right of
 * each edge: those whose centre is inside (even–odd), plus those an edge runs
 * through just inside it, stepping along the edge's longer axis so a slanted
 * edge steps as evenly as the inside does.
 */
function fillPolygons(polygons: Point[][], blocks: { width: number; height: number }): Uint8Array {
  const { width, height } = blocks;
  const cells = new Uint8Array(width * height);
  const set = (x: number, y: number) => {
    cells[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))] = 1;
  };
  for (let y = 0; y < height; y++) {
    const cy = y + 0.5;
    const crossings: number[] = [];
    for (const poly of polygons) {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
        if (a.y <= cy !== b.y <= cy) crossings.push(a.x + ((cy - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
    }
    crossings.sort((p, q) => p - q);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      for (let x = Math.ceil(crossings[i]! - 0.5); x < Math.ceil(crossings[i + 1]! - 0.5); x++) set(x, y);
    }
  }
  // Nudged a hair to the solid side, so an edge exactly on a block border marks the block inside it.
  const NUDGE = 1e-3;
  for (const poly of polygons) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (!len) continue;
      const nx = (-(b.y - a.y) / len) * NUDGE, ny = ((b.x - a.x) / len) * NUDGE;
      const [p, q] = [{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }];
      const alongX = Math.abs(q.x - p.x) >= Math.abs(q.y - p.y);
      const [lo, hi] = alongX ? [Math.min(p.x, q.x), Math.max(p.x, q.x)] : [Math.min(p.y, q.y), Math.max(p.y, q.y)];
      for (let s = Math.floor(lo); s <= Math.floor(hi - 1e-9); s++) {
        const t = Math.min(hi, Math.max(lo, s + 0.5));
        if (alongX) set(s, Math.floor(p.y + ((t - p.x) * (q.y - p.y)) / (q.x - p.x || 1)));
        else set(Math.floor(p.x + ((t - p.y) * (q.x - p.x)) / (q.y - p.y || 1)), s);
      }
    }
  }
  return cells;
}

/**
 * The drawn lines as straight segments: the skeleton's paths straightened to
 * `tolerance` pixels, scaled onto the blocks and joined with block lines, then
 * thinned again where lines landed side by side.
 */
function traceLines(mask: ImageMask, blocks: { width: number; height: number }, tolerance: number): Grid {
  const sx = blocks.width / mask.width, sy = blocks.height / mask.height;
  const out = new Uint8Array(blocks.width * blocks.height);
  const at = (p: Point) => ({
    x: Math.min(blocks.width - 1, Math.max(0, Math.floor((p.x + 0.5) * sx))),
    y: Math.min(blocks.height - 1, Math.max(0, Math.floor((p.y + 0.5) * sy))),
  });
  for (const path of remember(skeletonPaths, mask.id, () => tracePaths(mask))) {
    const points = simplify(path, tolerance).map(at);
    out[points[0]!.y * blocks.width + points[0]!.x] = 1;
    for (let i = 1; i < points.length; i++) {
      for (const p of rasterLine(points[i - 1]!, points[i]!)) out[p.y * blocks.width + p.x] = 1;
    }
  }
  return thin({ width: blocks.width, height: blocks.height, cells: out });
}

const NEIGHBOURS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]] as const;

/**
 * The picture's skeleton as pixel paths: one per stretch of line between
 * ends and junctions, plus one per closed loop. Touching junction pixels act
 * as a single junction at their middle, so lines meet at one point, and the
 * short barbs thinning leaves at sharp corners are dropped.
 */
function tracePaths(mask: ImageMask): Point[][] {
  const ink = decodeMask(mask);
  const { width, height, cells } = thin(ink);
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && cells[y * width + x] === 1;
  const around = (i: number) => {
    const x = i % width, y = Math.floor(i / width);
    return NEIGHBOURS.filter(([dx, dy]) => on(x + dx, y + dy)).map(([dx, dy]) => (y + dy) * width + x + dx);
  };
  const point = (i: number): Point => ({ x: i % width, y: Math.floor(i / width) });

  // Ends and junctions, grouped where they touch.
  const node = new Int32Array(width * height).fill(-1);
  const nodes: { at: Point; branches: number }[] = [];
  const paths: Point[][] = [];
  let skeletonSize = 0;
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) continue;
    skeletonSize++;
    const degree = around(i).length;
    if (degree === 0) paths.push([point(i)]);
    if (degree === 2 || node[i]! >= 0) continue;
    const group = [i];
    node[i] = nodes.length;
    for (let k = 0; k < group.length; k++) {
      for (const j of around(group[k]!)) {
        if (node[j]! < 0 && around(j).length !== 2) (node[j] = nodes.length), group.push(j);
      }
    }
    const at = group.map(point).reduce((s, p) => ({ x: s.x + p.x / group.length, y: s.y + p.y / group.length }), { x: 0, y: 0 });
    nodes.push({ at, branches: 0 });
  }

  // Walk out of each node along each line until the next node.
  const seen = new Uint8Array(width * height);
  const edges: { path: Point[]; from: number; to: number }[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i] || node[i]! < 0) continue;
    for (const first of around(i)) {
      if (node[first]! >= 0 || seen[first]) continue;
      const path = [nodes[node[i]!]!.at];
      let prev = i, at = first;
      while (node[at]! < 0 && !seen[at]) {
        seen[at] = 1;
        path.push(point(at));
        const step = around(at).find(j => j !== prev && (node[j]! >= 0 || !seen[j]));
        if (step === undefined) break;
        prev = at;
        at = step;
      }
      const to = node[at]!;
      if (to >= 0) path.push(nodes[to]!.at);
      edges.push({ path, from: node[i]!, to });
      nodes[node[i]!]!.branches++;
      if (to >= 0) nodes[to]!.branches++;
    }
  }

  // Barbs: short stretches from a loose end, or looping straight back to the same junction.
  const stroke = countInk(ink) / Math.max(1, skeletonSize);
  const loose = (n: number) => n < 0 || nodes[n]!.branches === 1;
  // A short stroke on its own (loose at both ends) is a real mark, not a barb.
  const barb = (e: { path: Point[]; from: number; to: number }) =>
    e.path.length < 2 * stroke && (e.from === e.to || loose(e.from) !== loose(e.to));
  const kept = edges.filter(e => !barb(e));

  // A junction left with just two lines once its barbs are gone is no junction: join them, so they straighten as one.
  const touching = new Map<number, typeof kept>();
  for (const e of kept) {
    for (const n of [e.from, e.to]) if (n >= 0) touching.set(n, [...(touching.get(n) ?? []), e]);
  }
  for (const [n, list] of touching) {
    if (list.length !== 2 || list[0] === list[1]) continue;
    let [a, b] = list as [(typeof kept)[number], (typeof kept)[number]];
    if (a.to !== n) a = { path: a.path.toReversed(), from: a.to, to: a.from };
    if (b.from !== n) b = { path: b.path.toReversed(), from: b.to, to: b.from };
    const joined = { path: [...a.path, ...b.path.slice(1)], from: a.from, to: b.to };
    kept.splice(kept.indexOf(list[0]!), 1);
    kept.splice(kept.indexOf(list[1]!), 1, joined);
    for (const end of [joined.from, joined.to]) {
      const at = touching.get(end);
      if (at) touching.set(end, at.map(e => (e === list[0] || e === list[1] ? joined : e)));
    }
    touching.delete(n);
  }
  for (const e of kept) paths.push(e.path);

  // What's left are closed loops with no ends or junctions.
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i] || seen[i] || node[i]! >= 0) continue;
    const path = [point(i)];
    seen[i] = 1;
    for (let at = i, prev = -1; ; ) {
      const step = around(at).find(j => j !== prev && !seen[j]);
      if (step === undefined) break;
      seen[step] = 1;
      path.push(point(step));
      prev = at;
      at = step;
    }
    path.push(point(i));
    paths.push(path);
  }
  return paths;
}

const countInk = (grid: Grid) => grid.cells.reduce((s, c) => s + c, 0);

/**
 * Ramer–Douglas–Peucker: the fewest points that keep the path within
 * `tolerance` of where it was. A closed path (last point = first) is first
 * restarted from the point farthest from its start, a real corner, so the
 * seam can't keep a corner that isn't one.
 */
function simplify(path: readonly Point[], tolerance: number): Point[] {
  if (path.length < 3) return [...path];
  const first = path[0]!, last = path.at(-1)!;
  const ring = first.x === last.x && first.y === last.y;
  if (ring) {
    const loop = path.slice(0, -1);
    const far = loop.reduce((best, p, i) => (dist2(p, first) > dist2(loop[best]!, first) ? i : best), 0);
    const turned = [...loop.slice(far), ...loop.slice(0, far), loop[far]!];
    return keep(turned, tolerance);
  }
  return keep(path, tolerance);
}

/** RDP on an open path, iteratively so long paths can't overflow the stack. */
function keep(path: readonly Point[], tolerance: number): Point[] {
  const kept = new Uint8Array(path.length);
  kept[0] = kept[path.length - 1] = 1;
  const stack: [number, number][] = [[0, path.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1, far = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = offLine(path[i]!, path[a]!, path[b]!);
      if (d > far) (far = d), (worst = i);
    }
    if (worst < 0) continue;
    kept[worst] = 1;
    stack.push([a, worst], [worst, b]);
  }
  return path.filter((_, i) => kept[i]);
}

const dist2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** How far `p` is from the segment `a`–`b`. */
function offLine(p: Point, a: Point, b: Point): number {
  const len2 = dist2(a, b);
  if (!len2) return Math.sqrt(dist2(p, a));
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
  return Math.sqrt(dist2(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }));
}

/**
 * Zhang–Suen thinning down to one-cell-wide lines, then drops the inside
 * corner of each L-shaped step so lines join diagonally, like a Line layer.
 */
export function thin(grid: Grid): Grid {
  const { width, height } = grid;
  if (!width || !height) return EMPTY_GRID;
  const cells = Uint8Array.from(grid.cells);
  const get = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : cells[y * width + x]!);
  // Neighbours clockwise from north: N, NE, E, SE, S, SW, W, NW.
  const ring = (x: number, y: number) => [
    get(x, y - 1), get(x + 1, y - 1), get(x + 1, y), get(x + 1, y + 1),
    get(x, y + 1), get(x - 1, y + 1), get(x - 1, y), get(x - 1, y - 1),
  ];

  for (let changed = true; changed; ) {
    changed = false;
    for (const pass of [0, 1]) {
      const drop: number[] = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!cells[y * width + x]) continue;
          const p = ring(x, y);
          const count = p.reduce((s, v) => s + v, 0);
          if (count < 2 || count > 6) continue;
          let flips = 0;
          for (let i = 0; i < 8; i++) if (!p[i] && p[(i + 1) % 8]) flips++;
          if (flips !== 1) continue;
          const [n, , e, , s, , w] = p;
          if (pass === 0 ? n! * e! * s! || e! * s! * w! : n! * e! * w! || n! * s! * w!) continue;
          drop.push(y * width + x);
        }
      }
      for (const i of drop) cells[i] = 0;
      if (drop.length) changed = true;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!cells[y * width + x]) continue;
      const p = ring(x, y);
      // Exactly two neighbours, at right angles (e.g. N and E): the diagonal joins them without this cell.
      if (p.reduce((s, v) => s + v, 0) !== 2) continue;
      for (let i = 0; i < 8; i += 2) {
        if (p[i] && p[(i + 2) % 8]) cells[y * width + x] = 0;
      }
    }
  }
  return { width, height, cells };
}

/** Reads a picture file into a mask, or null when nothing is drawn on it. Browser only. */
export async function loadImageMask(file: Blob): Promise<ImageMask | null> {
  const bitmap = await createImageBitmap(file);
  // Big photos are drawn smaller first; the mask is capped well below this anyway.
  const scale = Math.min(1, (MASK_MAX * 4) / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const ink = inkGrid(ctx.getImageData(0, 0, width, height).data, width, height);
  return ink && encodeMask(ink);
}
