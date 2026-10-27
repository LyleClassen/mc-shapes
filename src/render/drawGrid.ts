import type { CenterMarks } from "../shapes/center";
import type { Grid } from "../shapes/grid";
import type { Highlight } from "../shapes/patterns";
import type { Skin } from "./skins";
import { fitCanvas, type View } from "./viewport";

export interface DrawOptions {
  cell: number;
  skin: Skin;
  gridLines: boolean;
  /** Empty blocks drawn around the shape. Rows and columns stay in shape coordinates. */
  padding: number;
  highlightRow: number | null;
  doneRows: ReadonlySet<number>;
  center: CenterMarks;
  /** Outline the centre block — 1×1, 2×1, 1×2 or 2×2 depending on whether each side is odd or even. */
  showCenter: boolean;
  /** Guide blocks leading from the shape's walls to its centre; empty for none. */
  guides: readonly { x: number; y: number }[];
  /** Outline colours from `highlight`; null for none. */
  highlight: Highlight | null;
  /** The on-screen part of the drawing, in CSS pixels; only this is painted. */
  view: View;
}

const PAD = "#150f40";
const EMPTY_A = "#1d1750";
const EMPTY_B = "#211a5a";
const LINE = "rgba(255, 246, 223, 0.08)";
const LINE_MAJOR = "rgba(255, 246, 223, 0.22)";
const CENTER = "rgba(255, 210, 63, 0.85)";
const HIGHLIGHT = "rgba(255, 210, 63, 0.28)";
const DONE = "rgba(12, 9, 36, 0.62)";
const GUIDE = "rgba(255, 210, 63, 0.26)";
const GUIDE_EDGE = "rgba(255, 210, 63, 0.7)";
const CENTER_FILL = "rgba(255, 210, 63, 0.42)";
const MUTED = { face: "#3b3560", light: "#4a4475", dark: "#2b2648", text: "#ffffff" };

/**
 * Paints the grid as bevelled blocks, sized to `cell` CSS pixels per block.
 * The canvas covers only `view`, so the whole drawing can be far bigger than
 * any bitmap a browser will allocate.
 */
export function drawGrid(canvas: HTMLCanvasElement, grid: Grid, o: DrawOptions) {
  const { width: w, height: h } = grid;
  const c = o.cell;
  const p = o.padding;
  const ctx = fitCanvas(canvas, o.view);
  if (!ctx) return;

  ctx.fillStyle = PAD;
  ctx.fillRect(o.view.x, o.view.y, o.view.width, o.view.height);

  // Everything below is drawn in shape coordinates: (0, 0) is the shape's top-left block.
  ctx.translate(p * c, p * c);
  // The blocks in view: x0 ≤ x < x1, y0 ≤ y < y1.
  const x0 = Math.max(0, Math.floor(o.view.x / c) - p), x1 = Math.min(w, Math.ceil((o.view.x + o.view.width) / c) - p);
  const y0 = Math.max(0, Math.floor(o.view.y / c) - p), y1 = Math.min(h, Math.ceil((o.view.y + o.view.height) / c) - p);

  // With patterns on, the skin is ignored: outline blocks take their pattern colour
  // and the rest of the shape fades back.
  const hl = o.highlight;
  const shades = hl?.legend.map(({ color }) => skinOf(color));
  const faceOf = (i: number) => {
    const key = hl ? hl.keys[i]! : -1;
    return !hl ? o.skin : key < 0 ? MUTED : shades![key]!;
  };

  if (c < 2) {
    // Too small for fillRect per block (neighbours would bleed into seams), so
    // paint one pixel per block and let the browser scale it down.
    drawImage(ctx, grid, i => faceOf(i).face, c);
  } else {
    drawBlocks(ctx, grid, faceOf, c, x0, x1, y0, y1);
  }

  if (hl && c >= 18) {
    ctx.font = `800 ${Math.round(c * 0.45)}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        const key = hl.keys[i]!;
        if (key < 0) continue;
        ctx.fillStyle = shades![key]!.text;
        ctx.fillText(String(hl.steps[i]), (x + 0.5) * c, (y + 0.5) * c);
      }
    }
  }

  for (const y of o.doneRows) {
    if (y >= h) continue;
    ctx.fillStyle = DONE;
    ctx.fillRect(0, y * c, w * c, c);
  }

  // Grid lines cover the padding too; every 5th line is counted from the shape's edge.
  if (o.gridLines && c >= 5) {
    const lx0 = x0 === 0 ? -p : x0, lx1 = x1 === w ? w + p : x1;
    const ly0 = y0 === 0 ? -p : y0, ly1 = y1 === h ? h + p : y1;
    for (let x = lx0; x <= lx1; x++) line(ctx, x * c, ly0 * c, x * c, ly1 * c, x % 5 === 0 ? LINE_MAJOR : LINE);
    for (let y = ly0; y <= ly1; y++) line(ctx, lx0 * c, y * c, lx1 * c, y * c, y % 5 === 0 ? LINE_MAJOR : LINE);
  }

  const { x: cx, y: cy } = o.center;

  // Each guide cell is drawn as its own block so the line can be counted out to the wall.
  if (o.guides.length) {
    const inset = c >= 6 ? Math.max(1, Math.round(c / 6)) : 0;
    ctx.fillStyle = GUIDE;
    ctx.strokeStyle = GUIDE_EDGE;
    ctx.lineWidth = 1;
    for (const g of o.guides) {
      ctx.fillRect(g.x * c, g.y * c, c, c);
      if (inset) ctx.strokeRect(g.x * c + inset + 0.5, g.y * c + inset + 0.5, c - 2 * inset - 1, c - 2 * inset - 1);
    }
  }

  if (o.highlightRow !== null && o.highlightRow < h) {
    const y = o.highlightRow * c;
    ctx.fillStyle = HIGHLIGHT;
    ctx.fillRect(-p * c, y, (w + 2 * p) * c, c);
    ctx.strokeStyle = CENTER;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, y + 1, w * c - 2, c - 2);
  }

  if (o.showCenter) {
    const x = cx.start * c, y = cy.start * c, cw = cx.length * c, ch = cy.length * c;
    const stroke = Math.max(2, Math.round(c / 8));
    ctx.fillStyle = CENTER_FILL;
    ctx.fillRect(x, y, cw, ch);
    ctx.strokeStyle = "rgba(12, 9, 36, 0.9)";
    ctx.lineWidth = stroke + 2;
    ctx.strokeRect(x + stroke / 2, y + stroke / 2, cw - stroke, ch - stroke);
    ctx.strokeStyle = CENTER;
    ctx.lineWidth = stroke;
    ctx.strokeRect(x + stroke / 2, y + stroke / 2, cw - stroke, ch - stroke);
  }
}

type Shade = Pick<Skin, "face" | "light" | "dark">;

/** The checkerboard and bevelled blocks in x0–x1 × y0–y1, one fillRect each. */
function drawBlocks(
  ctx: CanvasRenderingContext2D,
  { width: w, height: h, cells }: Grid,
  shadeOf: (i: number) => Shade,
  c: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) {
  ctx.fillStyle = EMPTY_A;
  ctx.fillRect(0, 0, w * c, h * c);
  ctx.fillStyle = EMPTY_B;
  for (let y = y0; y < y1; y++) {
    for (let x = x0 + ((x0 + y) % 2); x < x1; x += 2) {
      if (!cells[y * w + x]) ctx.fillRect(x * c, y * c, c, c);
    }
  }

  const bevel = c >= 8 ? Math.max(1, Math.round(c / 7)) : 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * w + x;
      if (!cells[i]) continue;
      const s = shadeOf(i);
      const px = x * c, py = y * c;
      ctx.fillStyle = s.face;
      ctx.fillRect(px, py, c, c);
      if (!bevel) continue;
      ctx.fillStyle = s.light;
      ctx.fillRect(px, py, c, bevel);
      ctx.fillRect(px, py, bevel, c);
      ctx.fillStyle = s.dark;
      ctx.fillRect(px, py + c - bevel, c, bevel);
      ctx.fillRect(px + c - bevel, py, bevel, c);
    }
  }
}

/** The whole grid as one pixel per block, smoothed down to `c` pixels per block. */
function drawImage(ctx: CanvasRenderingContext2D, { width: w, height: h, cells }: Grid, faceOf: (i: number) => string, c: number) {
  const image = new ImageData(w, h);
  const px = new Uint32Array(image.data.buffer);
  const abgr = new Map<string, number>();
  const pack = (hex: string) => {
    let v = abgr.get(hex);
    if (v === undefined) {
      const [r, g, b] = rgb(hex);
      // ImageData is RGBA bytes; on little-endian machines that reads back as ABGR.
      v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
      abgr.set(hex, v);
    }
    return v;
  };
  const empty = pack(EMPTY_A);
  for (let i = 0; i < cells.length; i++) px[i] = cells[i] ? pack(faceOf(i)) : empty;
  const bitmap = new OffscreenCanvas(w, h);
  bitmap.getContext("2d")!.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w * c, h * c);
}

/** A block's bevel and label colours, derived from its face colour. */
function skinOf(face: string) {
  const [r, g, b] = rgb(face);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return {
    face,
    light: mix(face, "#ffffff", 0.35),
    dark: mix(face, "#000000", 0.35),
    text: lum > 0.45 ? "rgba(12, 9, 36, 0.9)" : "#ffffff",
  };
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blends `a` toward `b` by `t`, as a hex colour. */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a), [br, bg, bb] = rgb(b);
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
  ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
  ctx.stroke();
}
