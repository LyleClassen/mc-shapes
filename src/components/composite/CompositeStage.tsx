import { useCallback, useLayoutEffect, useRef, useState } from "react";
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
import { drawGrid } from "../../render/drawGrid";
import type { Skin } from "../../render/skins";
import { fitCanvas, visibleView } from "../../render/viewport";
import { getShape } from "../../shapes";
import type { CenterMarks } from "../../shapes/center";
import { fillParams } from "../../shapes/fill";
import type { Grid, Span } from "../../shapes/grid";
import type { Highlight } from "../../shapes/patterns";
import type { Point } from "../../shapes/raster";
import { mirrorText, NO_AXES } from "../../shapes/symmetry";
import { defaultValues } from "../../shapes/types";
import { useStageZoom, ZoomControls } from "../StageZoom";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

/** dataTransfer type for a shape dragged in from the palette. */
export const SHAPE_TYPE = "application/x-composite-shape";

interface Props {
  api: CompositeApi;
  /** The whole flattened canvas. */
  canvas: Grid;
  /** Centre of the trimmed plan in canvas coordinates; null with no blocks. */
  center: CenterMarks | null;
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

const NO_CENTER: CenterMarks = { x: { start: 0, length: 0 }, y: { start: 0, length: 0 }, mirror: NO_AXES, straight: [] };
// Matches the stage's p-5.
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
export function CompositeStage({ api, canvas, center, skin, highlight, highlightRow, doneRows, onHover }: Props) {
  const { composite, selected, tool, options } = api;
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const [gridLines, setGridLines] = useState(true);
  const [showCenter, setShowCenter] = useState(true);
  const [hover, setHover] = useState<Point | null>(null);
  const [rect, setRect] = useState<{ from: Point; to: Point; restore: boolean } | null>(null);
  const drag = useRef<Drag | null>(null);

  const { width, height } = composite.canvas;
  const zoom = useStageZoom(stageRef, contentRef, width, height, STAGE_PADDING);
  const { cell } = zoom;
  const restoring = options.eraseMode === "restore" && selected?.kind === "eraser";

  const drawBase = useCallback(() => {
    const stage = stageRef.current, content = contentRef.current, el = baseRef.current;
    if (!stage || !content || !el) return;
    drawGrid(el, canvas, {
      cell, skin, gridLines, padding: 0, highlightRow, doneRows, center: center ?? NO_CENTER, showCenter: showCenter && !!center,
      guides: [], highlight, view: visibleView(stage, content),
    });
  }, [canvas, cell, skin, gridLines, highlightRow, doneRows, center, showCenter, highlight]);
  useLayoutEffect(drawBase, [drawBase, zoom.stageSize]);

  const drawOverlay = useCallback(() => {
    const stage = stageRef.current, content = contentRef.current, el = overRef.current;
    if (!stage || !content || !el) return;
    const ctx = fitCanvas(el, visibleView(stage, content));
    if (!ctx) return;

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
  }, [composite, cell, selected, tool, options, restoring, hover, rect, api.flashId]);
  useLayoutEffect(drawOverlay, [drawOverlay, zoom.stageSize]);

  const cellAt = (e: { clientX: number; clientY: number }): Point => {
    const r = contentRef.current!.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / cell), y: Math.floor((e.clientY - r.top) / cell) };
  };

  /** Which endpoint of the selected line, if any, the pointer is on. */
  const handleAt = (e: { clientX: number; clientY: number }, line: LineLayer): "a" | "b" | null => {
    const r = contentRef.current!.getBoundingClientRect();
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
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <ZoomControls zoom={zoom} />
        <Toggle variant="chip" pressed={gridLines} onPressedChange={setGridLines}>
          Grid lines
        </Toggle>
        <Toggle variant="chip" pressed={showCenter} onPressedChange={setShowCenter}>
          Centre
        </Toggle>
      </div>

      <div
        ref={stageRef}
        onScroll={() => {
          drawBase();
          drawOverlay();
        }}
        onDragOver={e => {
          if (!e.dataTransfer.types.includes(SHAPE_TYPE)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={onDrop}
        className="relative flex h-[min(68vh,760px)] min-h-80 overflow-auto rounded-md border-[3px] border-border bg-sky-deep p-5 shadow-[inset_0_0_0_2px_var(--shadow),5px_5px_0_var(--shadow)]"
      >
        <div
          ref={contentRef}
          style={{ width: width * cell, height: height * cell }}
          className="relative m-auto shrink-0 shadow-[0_0_0_3px_var(--shadow),0_12px_40px_rgba(0,0,0,0.45)]"
        >
          <canvas ref={baseRef} className="absolute [image-rendering:pixelated]" />
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
            className={cn("absolute touch-none", tool === "move" ? "cursor-move" : "cursor-crosshair")}
          />
        </div>
        {!composite.layers.length && (
          <div className="pointer-events-none absolute top-1/2 left-1/2 flex max-w-80 -translate-1/2 flex-col items-center gap-2 rounded-md border-2 border-dashed border-grass bg-[rgba(12,9,36,0.8)] px-5 py-4 text-center text-[13px] text-secondary-foreground">
            <b className="font-pixel text-[11px] leading-[1.5] text-grass">Drag a shape here to start</b>
            <span>Pick one from the bar above and drop it onto the canvas. Then draw lines or erase on top.</span>
          </div>
        )}
        {api.notice && (
          <div
            role="status"
            className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-[4px] bg-destructive px-3.5 py-2 text-[13px] font-extrabold text-sky-deep"
          >
            {api.notice}
          </div>
        )}
      </div>

      <div className="flex min-h-[22px] flex-wrap gap-4 text-[13px] text-muted-foreground" aria-live="polite">
        <span>
          Canvas {width} × {height}
        </span>
        {center && (
          <span>
            Centre {center.x.length}×{center.y.length} · x <b className="font-mono text-gold">{spanText(center.x)}</b> · y{" "}
            <b className="font-mono text-gold">{spanText(center.y)}</b>
            {mirrorText(center.mirror) && (
              <>
                {" "}
                · Mirrored <b className="font-mono text-gold">{mirrorText(center.mirror)}</b>
              </>
            )}
          </span>
        )}
        {hover && hover.x >= 0 && hover.y >= 0 && hover.x < width && hover.y < height && (
          <span>
            x <b className="font-mono text-gold">{hover.x}</b> · y <b className="font-mono text-gold">{hover.y}</b>
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

/** A span in the hover read-out's 0-based canvas coordinates, e.g. "63" or "63–64". */
const spanText = (s: Span) => (s.length === 1 ? `${s.start}` : `${s.start}–${s.start + s.length - 1}`);

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
