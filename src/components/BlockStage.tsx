import * as stylex from "@stylexjs/stylex";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { drawGrid, MAX_CANVAS_PX } from "../render/drawGrid";
import type { Skin } from "../render/skins";
import type { CenterMarks } from "../shapes/center";
import { isFilled, type Grid, type Span } from "../shapes/grid";
import { colors, fonts } from "../theme/tokens.stylex";

export interface Cell {
  x: number;
  y: number;
}

interface Props {
  grid: Grid;
  center: CenterMarks;
  /** Guide blocks to draw, chosen in the shape panel. */
  guides: readonly { x: number; y: number }[];
  skin: Skin;
  highlightRow: number | null;
  doneRows: ReadonlySet<number>;
  hover: Cell | null;
  onHover: (cell: Cell | null) => void;
}

const STAGE_PADDING = 24;
const MAX_PADDING = 16;

/** The zoomable 2D block view, with a toolbar and a hover read-out. */
export function BlockStage({ grid, center, guides, skin, highlightRow, doneRows, hover, onHover }: Props) {
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
        cell, skin, gridLines, padding, highlightRow, doneRows, center, showCenter, guides,
      });
  }, [grid, cell, skin, gridLines, padding, highlightRow, doneRows, center, showCenter, guides]);

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>): Cell | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cell) - padding;
    const y = Math.floor((e.clientY - rect.top) / cell) - padding;
    return x >= 0 && y >= 0 && x < grid.width && y < grid.height ? { x, y } : null;
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
        <button
          type="button"
          aria-pressed={showCenter}
          onClick={() => setShowCenter(v => !v)}
          {...stylex.props(styles.chip, showCenter && styles.chipOn)}
        >
          Centre
        </button>
        <div {...stylex.props(styles.padGroup)} role="group" aria-label="Padding">
          <span>Padding</span>
          <button
            type="button"
            aria-label="Less padding"
            disabled={padding <= 0}
            onClick={() => setPadding(p => Math.max(0, p - 1))}
            {...stylex.props(styles.stepper)}
          >
            −
          </button>
          <span {...stylex.props(styles.mono, styles.padValue)}>{padding}</span>
          <button
            type="button"
            aria-label="More padding"
            disabled={padding >= MAX_PADDING}
            onClick={() => setPadding(p => Math.min(MAX_PADDING, p + 1))}
            {...stylex.props(styles.stepper)}
          >
            +
          </button>
        </div>
      </div>

      <div ref={stageRef} {...stylex.props(styles.stage)}>
        {grid.width > 0 ? (
          <canvas
            ref={canvasRef}
            onPointerMove={e => {
              const next = cellAt(e);
              if (next?.x !== hover?.x || next?.y !== hover?.y) onHover(next);
            }}
            onPointerLeave={() => onHover(null)}
            {...stylex.props(styles.canvas)}
          />
        ) : (
          <p {...stylex.props(styles.empty)}>No blocks with these settings — try making it bigger.</p>
        )}
      </div>

      <div {...stylex.props(styles.readout)} aria-live="polite">
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

function CenterReadout({ center: { x: cx, y: cy } }: { center: CenterMarks }) {
  const range = (s: Span) =>
    s.length === 1 ? `${s.start + 1}` : `${s.start + 1}–${s.start + s.length}`;
  return (
    <span>
      Centre {cx.length}×{cy.length} · Column <b {...stylex.props(styles.em)}>{range(cx)}</b> · Row{" "}
      <b {...stylex.props(styles.em)}>{range(cy)}</b>
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
        Column <b {...stylex.props(styles.em)}>{cell.x + 1}</b> · Row <b {...stylex.props(styles.em)}>{cell.y + 1}</b>
      </span>
      <span>
        From centre <b {...stylex.props(styles.em)}>{fmt(dx)}</b>, <b {...stylex.props(styles.em)}>{fmt(dy)}</b>
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

const styles = stylex.create({
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minWidth: 0,
  },
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
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
  chipOn: {
    borderColor: colors.diamond,
    color: colors.diamond,
  },
  padGroup: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: 800,
  },
  padValue: {
    minWidth: 18,
    textAlign: "center",
  },
  stepper: {
    width: 26,
    height: 26,
    padding: 0,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
    borderRadius: 3,
    backgroundColor: { default: colors.panelSunk, ":hover": colors.panelRaised },
    color: colors.ink,
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1,
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    opacity: { default: 1, ":disabled": 0.4 },
  },
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
  zoom: {
    flexGrow: 1,
    minWidth: 0,
    accentColor: colors.diamond,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.diamond,
    minWidth: 38,
    textAlign: "right",
  },
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
    backgroundImage:
      "radial-gradient(circle at 20% 15%, rgba(185,140,255,0.16), transparent 40%), radial-gradient(circle at 85% 90%, rgba(82,241,229,0.12), transparent 45%)",
    boxShadow: `inset 0 0 0 2px ${colors.shadow}, 5px 5px 0 ${colors.shadow}`,
  },
  canvas: {
    margin: "auto",
    flexShrink: 0,
    cursor: "crosshair",
    imageRendering: "pixelated",
    boxShadow: `0 0 0 3px ${colors.shadow}, 0 12px 40px rgba(0,0,0,0.45)`,
    touchAction: "none",
  },
  empty: {
    margin: "auto",
    color: colors.inkFaint,
    fontWeight: 700,
  },
  readout: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    minHeight: 22,
    fontSize: 13,
    color: colors.inkFaint,
  },
  em: {
    fontFamily: fonts.mono,
    color: colors.gold,
  },
});
