import { applyFill, fillParams } from "../shapes/fill";
import { EMPTY_GRID, gridFrom, trim, type Grid } from "../shapes/grid";
import { outsideAir } from "../shapes/patterns";
import { centreParam, centreParity, mirrorGrid, NO_AXES, type Axes } from "../shapes/symmetry";
import { resolveValues, type ParamDef, type ParamValues } from "../shapes/types";
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
];

/** What a new image layer starts with: lines, plus a 1-thick outline ready for Silhouette. */
export const DEFAULT_IMAGE_VALUES: ParamValues = {
  centre: "free",
  size: 64,
  trace: "lines",
  closeGaps: 0,
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
const skeletons = new Map<string, Grid>();
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
  const { centre, size, trace, closeGaps } = resolveValues(imageParams, values);
  const fill = resolveValues(fillParams, values);
  const key = JSON.stringify([mask.id, centre, size, trace, trace === "silhouette" ? [closeGaps, fill] : null]);
  const cached = traceCache.get(key);
  if (cached) {
    traceCache.delete(key);
    traceCache.set(key, cached);
    return cached;
  }
  const blocks = traceSize(mask, Number(size), String(centre));
  // With a centre type, a symmetric picture is traced from one half and mirrored, so rounding can't skew it.
  const axes = centre === "free" ? NO_AXES : maskSymmetry(mask);
  const grid =
    trace === "silhouette"
      ? trim(applyFill(trim(mirrorGrid(traceSilhouette(decodeMask(mask), blocks, Number(closeGaps)), axes)), fill))
      : trim(mirrorGrid(traceLines(remember(skeletons, mask.id, () => thin(decodeMask(mask))), blocks), axes));
  traceCache.set(key, grid);
  if (traceCache.size > TRACE_CACHE_SIZE) traceCache.delete(traceCache.keys().next().value!);
  return grid;
}

/**
 * Everything the outside can't reach is solid; a block is solid when any of
 * its pixels is, so thin lines aren't missed. With `closeGaps`, openings up
 * to twice that many blocks wide are bridged before filling (a closing: grow
 * by `closeGaps`, fill from outside, shrink back).
 */
function traceSilhouette(mask: Grid, blocks: { width: number; height: number }, closeGaps: number): Grid {
  const outside = outsideAir(mask);
  const sx = blocks.width / mask.width, sy = blocks.height / mask.height;
  const cells = new Uint8Array(blocks.width * blocks.height);
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (outside[y * mask.width + x]) continue;
      cells[Math.min(blocks.height - 1, Math.floor(y * sy)) * blocks.width + Math.min(blocks.width - 1, Math.floor(x * sx))] = 1;
    }
  }
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
 * Scales a one-pixel skeleton onto the blocks, joining each pair of
 * neighbouring pixels with a block line so nothing breaks apart when blocks
 * are smaller than pixels, then thins again where lines landed side by side.
 */
function traceLines(skeleton: Grid, blocks: { width: number; height: number }): Grid {
  const { width, height, cells } = skeleton;
  const sx = blocks.width / width, sy = blocks.height / height;
  const out = new Uint8Array(blocks.width * blocks.height);
  const at = (x: number, y: number) => ({
    x: Math.min(blocks.width - 1, Math.floor((x + 0.5) * sx)),
    y: Math.min(blocks.height - 1, Math.floor((y + 0.5) * sy)),
  });
  // Half the 8 directions, so each pair is joined once.
  const forward = [[1, 0], [-1, 1], [0, 1], [1, 1]] as const;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!cells[y * width + x]) continue;
      const a = at(x, y);
      out[a.y * blocks.width + a.x] = 1;
      for (const [dx, dy] of forward) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny >= height || !cells[ny * width + nx]) continue;
        for (const p of rasterLine(a, at(nx, ny))) out[p.y * blocks.width + p.x] = 1;
      }
    }
  }
  return thin({ width: blocks.width, height: blocks.height, cells: out });
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
