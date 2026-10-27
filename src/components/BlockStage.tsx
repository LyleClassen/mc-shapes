import { MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { drawGrid, MAX_CANVAS_PX } from "../render/drawGrid";
import type { Skin } from "../render/skins";
import type { CenterMarks } from "../shapes/center";
import type { Highlight } from "../shapes/patterns";
import { isFilled, type Grid, type Span } from "../shapes/grid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";

export interface Cell {
  x: number;
  y: number;
}

interface Props {
  grid: Grid;
  center: CenterMarks;
  /** Guide blocks to draw, chosen in the shape panel. */
  guides: readonly { x: number; y: number }[];
  /** Outline colours chosen in the fill panel. */
  highlight: Highlight | null;
  skin: Skin;
  highlightRow: number | null;
  doneRows: ReadonlySet<number>;
  hover: Cell | null;
  onHover: (cell: Cell | null) => void;
}

// Matches the stage's p-6.
const STAGE_PADDING = 24;
const MAX_PADDING = 16;

/** The zoomable 2D block view, with a toolbar and a hover read-out. */
export function BlockStage({ grid, center, guides, highlight, skin, highlightRow, doneRows, hover, onHover }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageSize = useElementSize(stageRef);
  const [zoom, setZoom] = useState<number | null>(null);
  const [gridLines, setGridLines] = useState(true);
  const [showCenter, setShowCenter] = useState(true);
  const [padding, setPadding] = useState(1);

  const viewW = grid.width + 2 * padding;
  const viewH = grid.height + 2 * padding;
  const longest = Math.max(viewW, viewH, 1);
  const maxCell = Math.max(2, Math.min(48, Math.floor(MAX_CANVAS_PX / longest / (window.devicePixelRatio || 1))));
  const fitCell = Math.floor(
    Math.min(
      (stageSize.width - STAGE_PADDING * 2) / viewW,
      (stageSize.height - STAGE_PADDING * 2) / viewH,
    ),
  );
  const cell = Math.max(2, Math.min(maxCell, zoom ?? fitCell));

  useLayoutEffect(() => {
    if (canvasRef.current) drawGrid(canvasRef.current, grid, {
        cell, skin, gridLines, padding, highlightRow, doneRows, center, showCenter, guides, highlight,
      });
  }, [grid, cell, skin, gridLines, padding, highlightRow, doneRows, center, showCenter, guides, highlight]);

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>): Cell | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cell) - padding;
    const y = Math.floor((e.clientY - rect.top) / cell) - padding;
    return x >= 0 && y >= 0 && x < grid.width && y < grid.height ? { x, y } : null;
  };

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Toggle variant="chip" pressed={zoom === null} onPressedChange={() => setZoom(null)}>
          Fit
        </Toggle>
        <Label className="min-w-[180px] grow text-[13px] text-secondary-foreground">
          Zoom
          <Slider tone="diamond" min={2} max={maxCell} value={cell} onValueChange={v => setZoom(v as number)} />
          <span className="min-w-[38px] text-right font-mono text-xs text-diamond">{cell}px</span>
        </Label>
        <Toggle variant="chip" pressed={gridLines} onPressedChange={setGridLines}>
          Grid lines
        </Toggle>
        <Toggle variant="chip" pressed={showCenter} onPressedChange={setShowCenter}>
          Centre
        </Toggle>
        <div className="flex items-center gap-1.5 text-[13px] font-extrabold text-secondary-foreground" role="group" aria-label="Padding">
          <span>Padding</span>
          <Button size="icon" aria-label="Less padding" disabled={padding <= 0} onClick={() => setPadding(p => Math.max(0, p - 1))}>
            <MinusIcon />
          </Button>
          <span className="min-w-[18px] text-center font-mono text-xs text-diamond">{padding}</span>
          <Button
            size="icon"
            aria-label="More padding"
            disabled={padding >= MAX_PADDING}
            onClick={() => setPadding(p => Math.min(MAX_PADDING, p + 1))}
          >
            <PlusIcon />
          </Button>
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative flex h-[min(68vh,760px)] min-h-80 overflow-auto rounded-md border-[3px] border-border bg-sky-deep p-6 shadow-[inset_0_0_0_2px_var(--shadow),5px_5px_0_var(--shadow)]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 15%, rgba(185,140,255,0.16), transparent 40%), radial-gradient(circle at 85% 90%, rgba(82,241,229,0.12), transparent 45%)",
        }}
      >
        {grid.width > 0 ? (
          <canvas
            ref={canvasRef}
            onPointerMove={e => {
              const next = cellAt(e);
              if (next?.x !== hover?.x || next?.y !== hover?.y) onHover(next);
            }}
            onPointerLeave={() => onHover(null)}
            className="m-auto shrink-0 cursor-crosshair touch-none shadow-[0_0_0_3px_var(--shadow),0_12px_40px_rgba(0,0,0,0.45)] [image-rendering:pixelated]"
          />
        ) : (
          <p className="m-auto font-bold text-muted-foreground">No blocks with these settings — try making it bigger.</p>
        )}
      </div>

      <div className="flex min-h-[22px] flex-wrap gap-4 text-[13px] text-muted-foreground" aria-live="polite">
        {hover ? (
          <HoverReadout grid={grid} cell={hover} />
        ) : (
          <>
            <span>Hover a block to see its position</span>
            {grid.width > 0 && <CenterReadout center={center} />}
          </>
        )}
      </div>
    </div>
  );
}

const EM = "font-mono text-gold";

function CenterReadout({ center: { x: cx, y: cy } }: { center: CenterMarks }) {
  const range = (s: Span) =>
    s.length === 1 ? `${s.start + 1}` : `${s.start + 1}–${s.start + s.length}`;
  return (
    <span>
      Centre {cx.length}×{cy.length} · Column <b className={EM}>{range(cx)}</b> · Row{" "}
      <b className={EM}>{range(cy)}</b>
    </span>
  );
}

function HoverReadout({ grid, cell }: { grid: Grid; cell: Cell }) {
  const dx = cell.x - (grid.width - 1) / 2;
  const dy = cell.y - (grid.height - 1) / 2;
  const fmt = (n: number) => (n > 0 ? `+${n}` : n === 0 ? "0" : `−${-n}`);
  return (
    <>
      <span>
        Column <b className={EM}>{cell.x + 1}</b> · Row <b className={EM}>{cell.y + 1}</b>
      </span>
      <span>
        From centre <b className={EM}>{fmt(dx)}</b>, <b className={EM}>{fmt(dy)}</b>
      </span>
      <span>{isFilled(grid, cell.x, cell.y) ? "■ block" : "□ empty"}</span>
    </>
  );
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
