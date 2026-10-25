/**
 * PROTOTYPE, throwaway. The composite canvas: draws the flatten with the real
 * drawGrid, then an overlay for selection, handles and previews. How a click
 * picks a layer is the main thing the variants disagree on, so it's a prop.
 */
import * as stylex from "@stylexjs/stylex";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { drawGrid } from "../render/drawGrid";
import type { Skin } from "../render/skins";
import type { CenterMarks } from "../shapes/center";
import { colors, fonts } from "../theme/tokens.stylex";
import {
  brushCells,
  flatten,
  layersAt,
  makeShapeLayer,
  moveBy,
  nameFor,
  newId,
  parseCell,
  placed,
  rectCells,
  shapeGrid,
  snap45,
  type Composite,
  type EraserLayer,
  type Layer,
  type LineLayer,
  type Pt,
} from "./engine";
import type { CompositeApi } from "./useComposite";

/**
 * - auto: a Move click picks the topmost layer under the cursor (Aseprite "Auto Select Layer").
 * - modifier: Move drags the selected layer from anywhere; Ctrl/⌘-click picks from the canvas.
 * - cycle: a click picks the topmost layer; Alt-click steps down through the layers under the cursor.
 */
export type PickMode = "auto" | "modifier" | "cycle";

interface Props {
  api: CompositeApi;
  skin: Skin;
  pick: PickMode;
  /** Canvas row to highlight (from the row guide), or null. */
  highlightRow?: number | null;
  /** Accept shapes dragged in from a palette (dataTransfer "text/shape"). */
  acceptDrop?: boolean;
  onHoverCell?: (p: Pt | null) => void;
  height?: string;
}

const NO_CENTER = { x: { start: 0, length: 0 }, y: { start: 0, length: 0 } } as unknown as CenterMarks;

type Drag =
  | { kind: "move"; id: string; from: Pt; original: Layer }
  | { kind: "handle"; id: string; end: "a" | "b"; original: LineLayer }
  | { kind: "line"; id: string; from: Pt }
  | { kind: "brush"; id: string; last: Pt; restore: boolean }
  | { kind: "rect"; id: string | null; from: Pt; to: Pt; restore: boolean };

export function Stage({ api, skin, pick, highlightRow = null, acceptDrop, onHoverCell, height = "min(70vh, 780px)" }: Props) {
  const { composite: c, selected, tool, toolOpts } = api;
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const size = useElementSize(wrapRef);
  const [zoom, setZoom] = useState<number | null>(null);
  const [hover, setHover] = useState<Pt | null>(null);
  const [shift, setShift] = useState(false);
  const drag = useRef<Drag | null>(null);
  const [rectPreview, setRectPreview] = useState<{ from: Pt; to: Pt } | null>(null);

  const fit = Math.max(2, Math.floor(Math.min((size.width - 32) / c.width, (size.height - 32) / c.height)));
  const cell = Math.max(2, Math.min(40, zoom ?? fit));

  useLayoutEffect(() => {
    if (!baseRef.current) return;
    drawGrid(baseRef.current, flatten(c), {
      cell, skin, gridLines: true, padding: 0, highlightRow, doneRows: new Set(),
      center: NO_CENTER, showCenter: false, guides: [], highlight: null,
    });
  }, [c, cell, skin, highlightRow]);

  useLayoutEffect(() => {
    const cv = overRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.width * cell, h = c.height * cell;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Eraser cells of the selected eraser layer, so you can see what it holds.
    if (selected?.kind === "eraser") {
      ctx.fillStyle = "rgba(255, 91, 124, 0.35)";
      for (const k of selected.cells) {
        const p = parseCell(k);
        ctx.fillRect(p.x * cell, p.y * cell, cell, cell);
      }
    }

    const box = (l: Layer, color: string, dash: number[]) => {
      const { grid, x, y } = placed(l);
      if (!grid.width) return;
      ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x * cell - 1, y * cell - 1, grid.width * cell + 2, grid.height * cell + 2);
      ctx.setLineDash([]);
    };
    if (selected) box(selected, selected.visible ? "#52f1e5" : "rgba(143,133,201,0.8)", [6, 4]);
    const flashed = c.layers.find(l => l.id === api.flashId);
    if (flashed) {
      const { grid, x, y } = placed(flashed);
      ctx.fillStyle = "rgba(82, 241, 229, 0.25)";
      ctx.fillRect(x * cell, y * cell, grid.width * cell, grid.height * cell);
    }

    if (selected?.kind === "line") {
      for (const p of [selected.a, selected.b]) {
        ctx.fillStyle = "#ffd23f";
        ctx.strokeStyle = "#07051a";
        ctx.lineWidth = 2;
        const r = Math.max(4, cell * 0.45);
        ctx.beginPath();
        ctx.arc((p.x + 0.5) * cell, (p.y + 0.5) * cell, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    if (hover && tool === "shape") {
      const g = shapeGrid(makeShapeLayer(c, toolOpts.placeShapeId));
      const x = hover.x - Math.floor(g.width / 2), y = hover.y - Math.floor(g.height / 2);
      ctx.fillStyle = "rgba(114, 227, 108, 0.35)";
      for (let gy = 0; gy < g.height; gy++)
        for (let gx = 0; gx < g.width; gx++)
          if (g.cells[gy * g.width + gx]) ctx.fillRect((x + gx) * cell, (y + gy) * cell, cell, cell);
    }

    if (hover && tool === "eraser" && toolOpts.eraserShape === "brush") {
      const s = toolOpts.brushSize, off = Math.floor((s - 1) / 2);
      ctx.strokeStyle = toolOpts.eraseMode === "restore" ? "#72e36c" : "#ff5b7c";
      ctx.lineWidth = 2;
      ctx.strokeRect((hover.x - off) * cell, (hover.y - off) * cell, s * cell, s * cell);
    }

    if (rectPreview) {
      const x0 = Math.min(rectPreview.from.x, rectPreview.to.x), y0 = Math.min(rectPreview.from.y, rectPreview.to.y);
      const x1 = Math.max(rectPreview.from.x, rectPreview.to.x), y1 = Math.max(rectPreview.from.y, rectPreview.to.y);
      ctx.fillStyle = toolOpts.eraseMode === "restore" ? "rgba(114,227,108,0.3)" : "rgba(255,91,124,0.3)";
      ctx.fillRect(x0 * cell, y0 * cell, (x1 - x0 + 1) * cell, (y1 - y0 + 1) * cell);
    }

    if (hover && cell >= 6 && tool !== "eraser") {
      ctx.strokeStyle = "rgba(255,246,223,0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(hover.x * cell + 0.5, hover.y * cell + 0.5, cell - 1, cell - 1);
    }
  }, [c, cell, selected, hover, tool, toolOpts, rectPreview, api.flashId]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => setShift(e.shiftKey);
    window.addEventListener("keydown", k);
    window.addEventListener("keyup", k);
    return () => {
      window.removeEventListener("keydown", k);
      window.removeEventListener("keyup", k);
    };
  }, []);

  const cellAt = (e: { clientX: number; clientY: number }): Pt => {
    const r = overRef.current!.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / cell), y: Math.floor((e.clientY - r.top) / cell) };
  };

  const replace = (id: string, l: Layer) => (x: Composite) => ({ ...x, layers: x.layers.map(o => (o.id === id ? l : o)) });

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = cellAt(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (tool === "move") {
      if (selected?.kind === "line") {
        const end = near(selected.a, p) ? "a" : near(selected.b, p) ? "b" : null;
        if (end) {
          api.begin(selected.id);
          drag.current = { kind: "handle", id: selected.id, end, original: selected };
          return;
        }
      }
      let target: Layer | null = null;
      const under = layersAt(c, p);
      if (pick === "auto") target = under[0] ?? null;
      else if (pick === "modifier") target = e.ctrlKey || e.metaKey ? (under[0] ?? null) : selected;
      else {
        if (e.altKey && selected) {
          const i = under.findIndex(l => l.id === selected.id);
          target = under[(i + 1) % Math.max(1, under.length)] ?? null;
        } else target = under[0] ?? null;
      }
      if (pick !== "modifier" || e.ctrlKey || e.metaKey) {
        api.setSelectedId(target?.id ?? null);
        if (target && target.id !== selected?.id) api.flash(target.id);
      }
      if (!target) {
        if (pick === "modifier") api.say("Select a layer in the list first, or Ctrl-click one on the canvas");
        return;
      }
      if (!target.visible) {
        api.say(`"${target.name}" is hidden. Show it before moving it`);
        return;
      }
      api.begin(target.id);
      drag.current = { kind: "move", id: target.id, from: p, original: target };
      return;
    }

    if (tool === "shape") {
      api.addLayer(makeShapeLayer(c, toolOpts.placeShapeId, p));
      return;
    }

    if (tool === "line") {
      const id = newId();
      const layer: LineLayer = { kind: "line", id, name: nameFor(c, "line"), visible: true, a: p, b: p };
      api.begin(id);
      api.preview(x => {
        const i = x.layers.findIndex(l => l.id === selected?.id);
        const layers = [...x.layers];
        layers.splice(i >= 0 ? i + 1 : layers.length, 0, layer);
        return { ...x, layers };
      });
      api.setSelectedId(id);
      drag.current = { kind: "line", id, from: p };
      return;
    }

    if (tool === "eraser") {
      const restore = toolOpts.eraseMode === "restore";
      let target = selected?.kind === "eraser" ? selected : null;
      if (restore && !target) {
        api.say("Restore works on an eraser layer. Select one first");
        return;
      }
      if (toolOpts.eraserShape === "rect") {
        drag.current = { kind: "rect", id: target?.id ?? null, from: p, to: p, restore };
        setRectPreview({ from: p, to: p });
        return;
      }
      if (!target) {
        target = { kind: "eraser", id: newId(), name: nameFor(c, "eraser"), visible: true, cells: [] };
        const fresh = target;
        api.begin(fresh.id);
        api.preview(x => ({ ...x, layers: [...x.layers, fresh] }));
        api.setSelectedId(fresh.id);
      } else api.begin(target.id);
      drag.current = { kind: "brush", id: target.id, last: p, restore };
      paint(target.id, p, p, restore);
    }
  };

  const paint = (id: string, from: Pt, to: Pt, restore: boolean) => {
    const cells = brushCells(c, from, to, toolOpts.brushSize);
    api.preview(x => ({
      ...x,
      layers: x.layers.map(l => (l.id === id && l.kind === "eraser" ? applyCells(l, cells, restore) : l)),
    }));
  };

  const onMove = (e: React.PointerEvent) => {
    const p = cellAt(e);
    if (p.x !== hover?.x || p.y !== hover?.y) {
      setHover(p);
      onHoverCell?.(p);
    }
    const d = drag.current;
    if (!d) return;
    if (d.kind === "move") api.preview(replace(d.id, moveBy(d.original, p.x - d.from.x, p.y - d.from.y)));
    else if (d.kind === "handle") {
      const other = d.end === "a" ? d.original.b : d.original.a;
      const q = e.shiftKey ? snap45(other, p) : p;
      api.preview(replace(d.id, { ...d.original, [d.end]: q }));
    } else if (d.kind === "line") {
      const b = e.shiftKey ? snap45(d.from, p) : p;
      api.preview(x => ({ ...x, layers: x.layers.map(l => (l.id === d.id && l.kind === "line" ? { ...l, b } : l)) }));
    } else if (d.kind === "brush") {
      if (p.x !== d.last.x || p.y !== d.last.y) paint(d.id, d.last, p, d.restore);
      d.last = p;
    } else if (d.kind === "rect") {
      d.to = p;
      setRectPreview({ from: d.from, to: p });
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "rect") {
      setRectPreview(null);
      const cells = rectCells(c, d.from, d.to);
      if (d.id) api.updateLayer(d.id, l => (l.kind === "eraser" ? applyCells(l, cells, d.restore) : l));
      else api.addLayer({ kind: "eraser", id: newId(), name: nameFor(c, "eraser"), visible: true, cells });
      return;
    }
    api.end();
  };

  const cursor = tool === "move" ? "move" : tool === "shape" ? "copy" : "crosshair";

  return (
    <div {...stylex.props(styles.outer)}>
      <div
        ref={wrapRef}
        {...stylex.props(styles.wrap)}
        style={{ height }}
        onDragOver={acceptDrop ? e => e.preventDefault() : undefined}
        onDrop={
          acceptDrop
            ? e => {
                const id = e.dataTransfer.getData("text/shape");
                if (!id) return;
                e.preventDefault();
                api.addLayer(makeShapeLayer(c, id, cellAt(e)));
              }
            : undefined
        }
      >
        <div {...stylex.props(styles.layers)}>
          <canvas ref={baseRef} {...stylex.props(styles.base)} />
          <canvas
            ref={overRef}
            {...stylex.props(styles.over)}
            style={{ cursor }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => {
              setHover(null);
              onHoverCell?.(null);
            }}
          />
        </div>
        {api.notice && <div {...stylex.props(styles.notice)}>{api.notice}</div>}
        <div {...stylex.props(styles.zoom)}>
          <button type="button" onClick={() => setZoom(Math.max(2, cell - 1))} {...stylex.props(styles.zbtn)}>−</button>
          <button type="button" onClick={() => setZoom(null)} {...stylex.props(styles.zbtn, zoom === null && styles.zon)}>
            Fit
          </button>
          <button type="button" onClick={() => setZoom(cell + 1)} {...stylex.props(styles.zbtn)}>+</button>
        </div>
      </div>
      <div {...stylex.props(styles.readout)}>
        <span>Canvas {c.width}×{c.height}</span>
        {hover && hover.x >= 0 && hover.y >= 0 && hover.x < c.width && hover.y < c.height && (
          <span>x <b {...stylex.props(styles.em)}>{hover.x}</b> · y <b {...stylex.props(styles.em)}>{hover.y}</b></span>
        )}
        <span>{hint(tool, pick, shift)}</span>
      </div>
    </div>
  );
}

function hint(tool: string, pick: PickMode, shift: boolean): string {
  if (tool === "line") return shift ? "Snapping to 45°" : "Drag to draw · Shift snaps to 45°";
  if (tool === "eraser") return "Drag to erase · strokes add to the selected eraser layer";
  if (tool === "shape") return "Click to place the shape centred on the cursor";
  if (pick === "auto") return "Click a layer to select it, drag to move";
  if (pick === "modifier") return "Drag moves the selected layer · Ctrl-click picks a layer";
  return "Click picks the top layer · Alt-click picks the one below";
}

const near = (a: Pt, b: Pt) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;

function applyCells(l: EraserLayer, cells: string[], restore: boolean): EraserLayer {
  const set = new Set(l.cells);
  for (const k of cells) restore ? set.delete(k) : set.add(k);
  return { ...l, cells: [...set] };
}

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 600, height: 500 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = new ResizeObserver(([e]) => e && setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    o.observe(el);
    return () => o.disconnect();
  }, [ref]);
  return size;
}

const styles = stylex.create({
  outer: { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 },
  wrap: {
    position: "relative",
    overflow: "auto",
    display: "flex",
    padding: 16,
    borderRadius: 6,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: colors.line,
    backgroundColor: colors.skyDeep,
    boxShadow: `inset 0 0 0 2px ${colors.shadow}, 5px 5px 0 ${colors.shadow}`,
  },
  layers: { position: "relative", margin: "auto", flexShrink: 0, boxShadow: `0 0 0 3px ${colors.shadow}` },
  base: { display: "block", imageRendering: "pixelated" },
  over: { position: "absolute", inset: 0, touchAction: "none" },
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
    fontWeight: 800,
    fontSize: 13,
    pointerEvents: "none",
  },
  zoom: { position: "sticky", alignSelf: "flex-end", bottom: 0, right: 0, display: "flex", gap: 4, marginLeft: -120 },
  zbtn: {
    minWidth: 30,
    height: 28,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
    borderRadius: 3,
    backgroundColor: colors.panelSunk,
    color: colors.inkSoft,
    fontFamily: fonts.body,
    fontWeight: 800,
    cursor: "pointer",
  },
  zon: { borderColor: colors.diamond, color: colors.diamond },
  readout: { display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, color: colors.inkFaint, minHeight: 20 },
  em: { fontFamily: fonts.mono, color: colors.gold },
});
