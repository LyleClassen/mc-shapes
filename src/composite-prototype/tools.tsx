/**
 * PROTOTYPE, throwaway. Small controls the variants arrange in different places.
 */
import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef } from "react";
import { colors, fonts } from "../theme/tokens.stylex";
import { describe, isOffCanvas, placed, type Layer } from "./engine";
import { styles as s } from "./LayerSettings";
import type { CompositeApi, Tool } from "./useComposite";

export const TOOLS: { id: Tool; label: string; glyph: string }[] = [
  { id: "move", label: "Move", glyph: "✥" },
  { id: "shape", label: "Place shape", glyph: "◆" },
  { id: "line", label: "Line", glyph: "╱" },
  { id: "eraser", label: "Eraser", glyph: "⌫" },
];

export function UndoRedo({ api }: { api: CompositeApi }) {
  return (
    <>
      <button type="button" title="Undo (Ctrl+Z)" disabled={!api.canUndo} onClick={api.undo} {...stylex.props(s.btn)}>
        ↶ Undo
      </button>
      <button type="button" title="Redo (Ctrl+Shift+Z)" disabled={!api.canRedo} onClick={api.redo} {...stylex.props(s.btn)}>
        ↷ Redo
      </button>
    </>
  );
}

export function EraserOptions({ api }: { api: CompositeApi }) {
  const o = api.toolOpts;
  const set = (patch: Partial<typeof o>) => api.setToolOpts(prev => ({ ...prev, ...patch }));
  const canRestore = api.selected?.kind === "eraser";
  return (
    <div {...stylex.props(s.row)}>
      <Seg value={o.eraserShape} options={[["brush", "Brush"], ["rect", "Rectangle"]]} onChange={v => set({ eraserShape: v })} />
      {o.eraserShape === "brush" && (
        <label {...stylex.props(s.num)}>
          Size
          <input type="range" min={1} max={8} value={o.brushSize} onChange={e => set({ brushSize: Number(e.target.value) })} />
          <b {...stylex.props(styles.mono)}>{o.brushSize}</b>
        </label>
      )}
      <span title={canRestore ? undefined : "Select an eraser layer to restore cells"}>
        <Seg
          value={o.eraseMode}
          options={[["erase", "Erase"], ["restore", "Restore"]]}
          disabled={canRestore ? [] : ["restore"]}
          onChange={v => set({ eraseMode: v })}
        />
      </span>
      <span {...stylex.props(s.muted)}>
        {api.selected?.kind === "eraser" ? `Adds to "${api.selected.name}"` : "Makes a new eraser layer"}
      </span>
    </div>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  disabled = [],
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  disabled?: T[];
}) {
  return (
    <span {...stylex.props(styles.seg)}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          disabled={disabled.includes(v)}
          onClick={() => onChange(v)}
          {...stylex.props(s.btn, styles.segBtn, value === v && s.on)}
        >
          {label}
        </button>
      ))}
    </span>
  );
}

/** A tiny render of one layer's own blocks (erasers in red). */
export function LayerThumb({ layer, size = 36 }: { layer: Layer; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const { grid } = placed(layer);
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr;
    cv.height = size * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#1b1547";
    ctx.fillRect(0, 0, size, size);
    if (!grid.width) return;
    const c = Math.min((size - 4) / grid.width, (size - 4) / grid.height);
    const ox = (size - grid.width * c) / 2, oy = (size - grid.height * c) / 2;
    ctx.fillStyle = layer.kind === "eraser" ? "#ff5b7c" : layer.kind === "line" ? "#ffd23f" : "#72e36c";
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++)
        if (grid.cells[y * grid.width + x]) ctx.fillRect(ox + x * c, oy + y * c, Math.max(1, c), Math.max(1, c));
  }, [layer, size]);
  return <canvas ref={ref} style={{ width: size, height: size, opacity: layer.visible ? 1 : 0.35 }} {...stylex.props(styles.thumb)} />;
}

/** Badges shared by every layer list: hidden, off canvas, empty. */
export function LayerBadges({ api, layer }: { api: CompositeApi; layer: Layer }) {
  return (
    <>
      {!layer.visible && <span {...stylex.props(styles.badge)}>hidden</span>}
      {isOffCanvas(api.composite, layer) && <span {...stylex.props(styles.badge, styles.badgeWarn)}>off canvas</span>}
      {layer.kind === "eraser" && !layer.cells.length && <span {...stylex.props(styles.badge)}>empty</span>}
    </>
  );
}

export { describe };

export const styles = stylex.create({
  mono: { fontFamily: fonts.mono, color: colors.diamond },
  seg: { display: "inline-flex" },
  segBtn: { borderRadius: 0 },
  thumb: { display: "block", flexShrink: 0, borderRadius: 2 },
  badge: {
    paddingBlock: 1,
    paddingInline: 5,
    borderRadius: 3,
    backgroundColor: colors.panelSunk,
    color: colors.inkFaint,
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  badgeWarn: { backgroundColor: colors.redstone, color: colors.skyDeep },
});
