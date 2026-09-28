import type { CenterMarks } from "../shapes/center";
import type { Grid } from "../shapes/grid";
import type { Skin } from "./skins";

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

/** Largest canvas edge we'll allocate, in device pixels (browsers cap around 16k). */
export const MAX_CANVAS_PX = 8192;

/** Paints the grid as bevelled blocks, sized to `cell` CSS pixels per block. */
export function drawGrid(canvas: HTMLCanvasElement, grid: Grid, o: DrawOptions) {
  const dpr = window.devicePixelRatio || 1;
  const { width: w, height: h, cells } = grid;
  const c = o.cell;
  const p = o.padding;
  const totalW = (w + 2 * p) * c;
  const totalH = (h + 2 * p) * c;
  canvas.width = Math.max(1, Math.round(totalW * dpr));
  canvas.height = Math.max(1, Math.round(totalH * dpr));
  canvas.style.width = `${totalW}px`;
  canvas.style.height = `${totalH}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = PAD;
  ctx.fillRect(0, 0, totalW, totalH);

  // Everything below is drawn in shape coordinates: (0, 0) is the shape's top-left block.
  ctx.translate(p * c, p * c);

  ctx.fillStyle = EMPTY_A;
  ctx.fillRect(0, 0, w * c, h * c);
  ctx.fillStyle = EMPTY_B;
  for (let y = 0; y < h; y++) {
    for (let x = (y % 2); x < w; x += 2) {
      if (!cells[y * w + x]) ctx.fillRect(x * c, y * c, c, c);
    }
  }

  const bevel = c >= 8 ? Math.max(1, Math.round(c / 7)) : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!cells[y * w + x]) continue;
      const px = x * c, py = y * c;
      ctx.fillStyle = o.skin.face;
      ctx.fillRect(px, py, c, c);
      if (!bevel) continue;
      ctx.fillStyle = o.skin.light;
      ctx.fillRect(px, py, c, bevel);
      ctx.fillRect(px, py, bevel, c);
      ctx.fillStyle = o.skin.dark;
      ctx.fillRect(px, py + c - bevel, c, bevel);
      ctx.fillRect(px + c - bevel, py, bevel, c);
    }
  }

  for (const y of o.doneRows) {
    if (y >= h) continue;
    ctx.fillStyle = DONE;
    ctx.fillRect(0, y * c, w * c, c);
  }

  // Grid lines cover the padding too; every 5th line is counted from the shape's edge.
  if (o.gridLines && c >= 5) {
    for (let x = -p; x <= w + p; x++) line(ctx, x * c, -p * c, x * c, (h + p) * c, x % 5 === 0 ? LINE_MAJOR : LINE);
    for (let y = -p; y <= h + p; y++) line(ctx, -p * c, y * c, (w + p) * c, y * c, y % 5 === 0 ? LINE_MAJOR : LINE);
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

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
  ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
  ctx.stroke();
}
