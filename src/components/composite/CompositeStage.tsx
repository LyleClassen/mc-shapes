import * as stylex from "@stylexjs/stylex";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  eraserCells,
  lineEndpoints,
  newEraserLayer,
  newLineLayer,
  newShapeLayer,
  paintEraser,
  setLineEndpoints,
  shapeGrid,
  type Composite,
  type Layer,
  type LineLayer,
} from "../../composite/composite";
import { brushCells, rectCells, snapLine } from "../../composite/draw";
import { insertLayer, layerBox, moveLayer, pickLayer, replaceLayer } from "../../composite/edit";
import type { CompositeApi } from "../../composite/useComposite";
import { drawGrid, MAX_CANVAS_PX } from "../../render/drawGrid";
import type { Skin } from "../../render/skins";
import { getShape } from "../../shapes";
import type { CenterMarks } from "../../shapes/center";
import { fillParams } from "../../shapes/fill";
import type { Grid } from "../../shapes/grid";
import type { Highlight } from "../../shapes/patterns";
import type { Point } from "../../shapes/raster";
import { defaultValues } from "../../shapes/types";
import { colors, fonts } from "../../theme/tokens.stylex";

/** dataTransfer type for a shape dragged in from the palette. */
export const SHAPE_TYPE = "application/x-composite-shape";

interface Props {
  api: CompositeApi;
  /** The whole flattened canvas. */
  canvas: Grid;
  skin: Skin;
  highlight: Highlight | null;
  /** Canvas row to highlight, from the row guide or the hover. */
  highlightRow: number | null;
  doneRows: ReadonlySet<number>;
  onHover: (cell: Point | null) => void;
}

type Drag =
  | { kind: "move"; from: Point; original: Layer }
  | { kind: "handle"; end: "a" | "b"; original: LineLayer }
  | { kind: "line"; from: Point; original: LineLayer }
  | { kind: "brush"; id: string; last: Point; restore: boolean }
  | { kind: "rect"; from: Point; to: Point; target: string | null; restore: boolean };

const NO_CENTER: CenterMarks = { x: { start: 0, length: 0 }, y: { start: 0, length: 0 }, straight: [] };
const STAGE_PADDING = 20;

const SELECTED = "#52f1e5";
const SELECTED_HIDDEN = "rgba(143, 133, 201, 0.85)";
const ERASED = "rgba(255, 91, 124, 0.38)";
const RESTORE = "rgba(114, 227, 108, 0.32)";
const HANDLE = "#ffd23f";
const FLASH = "rgba(82, 241, 229, 0.28)";
const HOVER = "rgba(255, 246, 223, 0.6)";

/**
 * The composite canvas: the flattened plan drawn by drawGrid, with an
 * overlay for the selection, line handles and tool previews. Move drags the
 * selected layer from anywhere; Ctrl/⌘-click picks the layer under the cursor.
 */
export function CompositeStage({ api, canvas, skin, highlight, highlightRow, doneRows, onHover }: Props) {
  const { composite, selected, tool, options } = api;
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const stageSize = useElementSize(stageRef);
  const [zoom, setZoom] = useState<number | null>(null);
  const [gridLines, setGridLines] = useState(true);
  const [hover, setHover] = useState<Point | null>(null);
  const [rect, setRect] = useState<{ from: Point; to: Point; restore: boolean } | null>(null);
  const drag = useRef<Drag | null>(null);

  const { width, height } = composite.canvas;
  const maxCell = Math.max(2, Math.min(48, Math.floor(MAX_CANVAS_PX / Math.max(width, height) / (window.devicePixelRatio || 1))));
  const fitCell = Math.floor(
    Math.min((stageSize.width - STAGE_PADDING * 2) / width, (stageSize.height - STAGE_PADDING * 2) / height),
  );
  const cell = Math.max(2, Math.min(maxCell, zoom ?? fitCell));
  const restoring = options.eraseMode === "restore" && selected?.kind === "eraser";

  useLayoutEffect(() => {
    if (!baseRef.current) return;
    drawGrid(baseRef.current, canvas, {
      cell, skin, gridLines, padding: 0, highlightRow, doneRows, center: NO_CENTER, showCenter: false, guides: [], highlight,
    });
  }, [canvas, cell, skin, gridLines, highlightRow, doneRows, highlight]);

  useLayoutEffect(() => {
    const el = overRef.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = width * cell, h = height * cell;
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (selected?.kind === "eraser") {
      ctx.fillStyle = ERASED;
      for (const p of eraserCells(selected)) ctx.fillRect(p.x * cell, p.y * cell, cell, cell);
    }

    const flashed = composite.layers.find(l => l.id === api.flashId);
    const flashBox = flashed && layerBox(flashed);
    if (flashBox) {
      ctx.fillStyle = FLASH;
      ctx.fillRect(flashBox.x * cell, flashBox.y * cell, flashBox.width * cell, flashBox.height * cell);
    }

    const box = selected && layerBox(selected);
    if (box) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = selected.visible ? SELECTED : SELECTED_HIDDEN;
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x * cell - 1, box.y * cell - 1, box.width * cell + 2, box.height * cell + 2);
      ctx.setLineDash([]);
    }

    if (selected?.kind === "line" && tool === "move") {
      for (const p of lineEndpoints(selected)) {
        ctx.fillStyle = HANDLE;
        ctx.strokeStyle = "#07051a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc((p.x + 0.5) * cell, (p.y + 0.5) * cell, handleRadius(cell), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    if (rect) {
      const [x0, x1] = [Math.min(rect.from.x, rect.to.x), Math.max(rect.from.x, rect.to.x)];
      const [y0, y1] = [Math.min(rect.from.y, rect.to.y), Math.max(rect.from.y, rect.to.y)];
      ctx.fillStyle = rect.restore ? RESTORE : ERASED;
      ctx.fillRect(x0 * cell, y0 * cell, (x1 - x0 + 1) * cell, (y1 - y0 + 1) * cell);
    } else if (hover && tool === "eraser" && options.eraserShape === "brush") {
      const size = options.brushSize, lo = -Math.floor((size - 1) / 2);
      ctx.strokeStyle = restoring ? "#72e36c" : "#ff5b7c";
      ctx.lineWidth = 2;
      ctx.strokeRect((hover.x + lo) * cell, (hover.y + lo) * cell, size * cell, size * cell);
    } else if (hover && cell >= 6) {
      ctx.strokeStyle = HOVER;
      ctx.lineWidth = 1;
      ctx.strokeRect(hover.x * cell + 0.5, hover.y * cell + 0.5, cell - 1, cell - 1);
    }
  }, [composite, width, height, cell, selected, tool, options, restoring, hover, rect, api.flashId]);

  const cellAt = (e: { clientX: number; clientY: number }): Point => {
    const r = overRef.current!.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / cell), y: Math.floor((e.clientY - r.top) / cell) };
  };

  /** Which endpoint of the selected line, if any, the pointer is on. */
  const handleAt = (e: { clientX: number; clientY: number }, line: LineLayer): "a" | "b" | null => {
    const r = overRef.current!.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const reach = Math.max(handleRadius(cell), cell / 2) + 3;
    const [a, b] = lineEndpoints(line);
    const near = (p: Point) => Math.hypot((p.x + 0.5) * cell - px, (p.y + 0.5) * cell - py) <= reach;
    return near(a) ? "a" : near(b) ? "b" : null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const p = cellAt(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    const c = api.composite;

    if (e.ctrlKey || e.metaKey) {
      const picked = pickLayer(c, p);
      api.select(picked?.id ?? null);
      if (picked && picked.id !== selected?.id) api.flash(picked.id);
      if (picked && tool === "move") startMove(picked, p);
      return;
    }

    if (tool === "move") {
      const end = selected?.kind === "line" ? handleAt(e, selected) : null;
      if (selected?.kind === "line" && end) {
        api.begin(selected.id);
        drag.current = { kind: "handle", end, original: selected };
      } else if (selected) startMove(selected, p);
      else api.say("Select a layer in the Layers panel first, or Ctrl-click one on the canvas");
      return;
    }

    if (tool === "line") {
      const line = newLineLayer(c, p, p);
      api.begin(line.id);
      api.preview(x => insertLayer(x, line, selected?.id ?? null));
      api.select(line.id);
      drag.current = { kind: "line", from: p, original: line };
      return;
    }

    const target = selected?.kind === "eraser" ? selected : null;
    api.begin(target?.id ?? null);
    if (options.eraserShape === "rect") {
      drag.current = { kind: "rect", from: p, to: p, target: target?.id ?? null, restore: restoring };
      setRect({ from: p, to: p, restore: restoring });
      return;
    }
    const cells = brushCells([p], options.brushSize);
    if (target) {
      api.preview(x => replaceLayer(x, paintEraser(target, cells, x.canvas, restoring)));
      drag.current = { kind: "brush", id: target.id, last: p, restore: restoring };
    } else {
      const eraser = newEraserLayer(c, cells);
      api.begin(eraser.id);
      api.preview(x => insertLayer(x, eraser, selected?.id ?? null));
      api.select(eraser.id);
      drag.current = { kind: "brush", id: eraser.id, last: p, restore: false };
    }
  };

  const startMove = (layer: Layer, from: Point) => {
    if (!layer.visible) {
      api.say(`"${layer.name}" is hidden. Show it before moving it`);
      return;
    }
    api.begin(layer.id);
    drag.current = { kind: "move", from, original: layer };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = cellAt(e);
    if (p.x !== hover?.x || p.y !== hover?.y) {
      setHover(p);
      onHover(p.x >= 0 && p.y >= 0 && p.x < width && p.y < height ? p : null);
    }
    const d = drag.current;
    if (!d) return;
    switch (d.kind) {
      case "move": {
        const { original: o } = d;
        api.preview(x => replaceLayer(x, moveLayer(o, o.x + p.x - d.from.x, o.y + p.y - d.from.y)));
        break;
      }
      case "handle": {
        const [a, b] = lineEndpoints(d.original);
        const fixed = d.end === "a" ? b : a;
        const moved = e.shiftKey ? snapLine(fixed, p) : p;
        api.preview(x => replaceLayer(x, d.end === "a" ? setLineEndpoints(d.original, moved, b) : setLineEndpoints(d.original, a, moved)));
        break;
      }
      case "line": {
        const to = e.shiftKey ? snapLine(d.from, p) : p;
        api.preview(x => replaceLayer(x, setLineEndpoints(d.original, d.from, to)));
        break;
      }
      case "brush": {
        if (p.x === d.last.x && p.y === d.last.y) break;
        const cells = brushCells([d.last, p], options.brushSize);
        d.last = p;
        api.preview(x => paintInto(x, d.id, cells, d.restore));
        break;
      }
      case "rect":
        d.to = p;
        setRect({ from: d.from, to: p, restore: d.restore });
        break;
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "rect") {
      setRect(null);
      const cells = rectCells(d.from, d.to);
      if (d.target) {
        api.preview(x => paintInto(x, d.target!, cells, d.restore));
      } else {
        const eraser = newEraserLayer(api.composite, cells);
        if (eraser.cells.length) {
          api.preview(x => insertLayer(x, eraser, selected?.id ?? null));
          api.select(eraser.id);
          api.end(eraser.id);
          return;
        }
      }
    }
    api.end();
  };

  const onDrop = (e: React.DragEvent) => {
    const shapeId = e.dataTransfer.getData(SHAPE_TYPE);
    if (!shapeId || !overRef.current) return;
    e.preventDefault();
    const shape = getShape(shapeId);
    const values = { ...defaultValues(shape.params), ...defaultValues(fillParams) };
    const grid = shapeGrid(shape.id, values);
    const at = cellAt(e);
    const layer = newShapeLayer(api.composite, shape.id, values);
    api.addLayer(moveLayer(layer, at.x - Math.floor(grid.width / 2), at.y - Math.floor(grid.height / 2)));
  };

  return (
    <div {...stylex.props(styles.wrap)}>
      <div {...stylex.props(styles.toolbar)}>
        <button type="button" onClick={() => setZoom(null)} {...stylex.props(styles.chip, zoom === null && styles.chipOn)}>
          Fit
        </button>
        <label {...stylex.props(styles.zoomLabel)}>
          Zoom
          <input
            type="range"
            min={2}
            max={maxCell}
            value={cell}
            onChange={e => setZoom(Number(e.target.value))}
            {...stylex.props(styles.zoom)}
          />
          <span {...stylex.props(styles.mono)}>{cell}px</span>
        </label>
        <button
          type="button"
          aria-pressed={gridLines}
          onClick={() => setGridLines(g => !g)}
          {...stylex.props(styles.chip, gridLines && styles.chipOn)}
        >
          Grid lines
        </button>
      </div>

      <div
        ref={stageRef}
        onDragOver={e => {
          if (!e.dataTransfer.types.includes(SHAPE_TYPE)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={onDrop}
        {...stylex.props(styles.stage)}
      >
        <div {...stylex.props(styles.layers)}>
          <canvas ref={baseRef} {...stylex.props(styles.base)} />
          <canvas
            ref={overRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => {
              setHover(null);
              onHover(null);
            }}
            {...stylex.props(styles.over, tool === "move" ? styles.moveCursor : styles.drawCursor)}
          />
        </div>
        {!composite.layers.length && (
          <div {...stylex.props(styles.empty)}>
            <b {...stylex.props(styles.emptyTitle)}>Drag a shape here to start</b>
            <span>Pick one from the bar above and drop it onto the canvas. Then draw lines or erase on top.</span>
          </div>
        )}
        {api.notice && (
          <div role="status" {...stylex.props(styles.notice)}>
            {api.notice}
          </div>
        )}
      </div>

      <div {...stylex.props(styles.readout)} aria-live="polite">
        <span>
          Canvas {width} × {height}
        </span>
        {hover && hover.x >= 0 && hover.y >= 0 && hover.x < width && hover.y < height && (
          <span>
            x <b {...stylex.props(styles.em)}>{hover.x}</b> · y <b {...stylex.props(styles.em)}>{hover.y}</b>
          </span>
        )}
        <span>{hint(api)}</span>
      </div>
    </div>
  );
}

/** Paints cells into an eraser layer already in the composite, reading its latest version. */
function paintInto(c: Composite, id: string, cells: ReturnType<typeof brushCells>, restore: boolean): Composite {
  const layer = c.layers.find(l => l.id === id);
  return layer?.kind === "eraser" ? replaceLayer(c, paintEraser(layer, cells, c.canvas, restore)) : c;
}

const handleRadius = (cell: number) => Math.max(5, cell * 0.45);

function hint({ tool, selected, options }: CompositeApi): string {
  if (tool === "line") return "Drag to draw a line · Shift snaps to 0°, 45° or 90°";
  if (tool === "eraser") {
    const into = selected?.kind === "eraser" ? `adds to "${selected.name}"` : "makes a new eraser layer";
    return `${options.eraserShape === "rect" ? "Drag a box" : "Drag to paint"} · ${into}`;
  }
  if (selected?.kind === "line") return "Drag to move the line, or its yellow handles · Shift snaps · Ctrl-click picks a layer";
  if (selected) return `Drag to move "${selected.name}" · Ctrl-click picks a layer`;
  return "Ctrl-click a layer to pick it, or drag a shape in from the bar above";
}

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 600, height: 500 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

const styles = stylex.create({
  wrap: { display: "flex", flexDirection: "column", gap: 10, minWidth: 0 },
  toolbar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 },
  chip: {
    paddingBlock: 6,
    paddingInline: 12,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
    borderRadius: 3,
    backgroundColor: { default: colors.panelSunk, ":hover": colors.panelRaised },
    color: colors.inkSoft,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  chipOn: { borderColor: colors.diamond, color: colors.diamond },
  zoomLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexGrow: 1,
    minWidth: 180,
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: 800,
  },
  zoom: { flexGrow: 1, minWidth: 0, accentColor: colors.diamond },
  mono: { fontFamily: fonts.mono, fontSize: 12, color: colors.diamond, minWidth: 38, textAlign: "right" },
  stage: {
    position: "relative",
    height: "min(68vh, 760px)",
    minHeight: 320,
    overflow: "auto",
    display: "flex",
    padding: STAGE_PADDING,
    borderRadius: 6,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: colors.line,
    backgroundColor: colors.skyDeep,
    boxShadow: `inset 0 0 0 2px ${colors.shadow}, 5px 5px 0 ${colors.shadow}`,
  },
  layers: { position: "relative", margin: "auto", flexShrink: 0, boxShadow: `0 0 0 3px ${colors.shadow}, 0 12px 40px rgba(0,0,0,0.45)` },
  base: { display: "block", imageRendering: "pixelated" },
  over: { position: "absolute", inset: 0, touchAction: "none" },
  moveCursor: { cursor: "move" },
  drawCursor: { cursor: "crosshair" },
  notice: {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    paddingBlock: 8,
    paddingInline: 14,
    borderRadius: 4,
    backgroundColor: colors.redstone,
    color: colors.skyDeep,
    fontSize: 13,
    fontWeight: 800,
    pointerEvents: "none",
  },
  empty: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    maxWidth: 320,
    paddingBlock: 16,
    paddingInline: 20,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.grass,
    borderRadius: 6,
    backgroundColor: "rgba(12, 9, 36, 0.8)",
    color: colors.inkSoft,
    fontSize: 13,
    textAlign: "center",
    pointerEvents: "none",
  },
  emptyTitle: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 1.5, color: colors.grass },
  readout: { display: "flex", flexWrap: "wrap", gap: 16, minHeight: 22, fontSize: 13, color: colors.inkFaint },
  em: { fontFamily: fonts.mono, color: colors.gold },
});
