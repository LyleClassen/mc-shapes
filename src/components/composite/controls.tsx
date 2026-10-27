import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";
import { layerGrid, type Layer } from "../../composite/composite";
import { colors, fonts } from "../../theme/tokens.stylex";

/**
 * A whole-number field. While typing, only values inside min–max are sent,
 * so a canvas size of 1 on the way to 128 isn't clamped to 8; leaving the
 * field sends the clamped value and shows what was kept.
 */
export function NumberField({
  label,
  value,
  min = -Infinity,
  max = Infinity,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  return (
    <label {...stylex.props(styles.field)}>
      <span>{label}</span>
      <input
        type="number"
        step={1}
        min={Number.isFinite(min) ? min : undefined}
        max={Number.isFinite(max) ? max : undefined}
        value={draft ?? value}
        onChange={e => {
          setDraft(e.target.value);
          const v = e.target.valueAsNumber;
          if (Number.isFinite(v) && v === clamp(v)) onChange(v);
        }}
        onBlur={e => {
          const v = e.target.valueAsNumber;
          if (Number.isFinite(v) && clamp(v) !== value) onChange(clamp(v));
          setDraft(null);
        }}
        {...stylex.props(styles.input, styles.numberInput)}
      />
    </label>
  );
}

/** A row of mutually exclusive buttons. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = [],
  title,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  disabled?: readonly T[];
  title?: string;
}) {
  return (
    <span role="radiogroup" aria-label={label} title={title} {...stylex.props(styles.segmented)}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          disabled={disabled.includes(v)}
          onClick={() => onChange(v)}
          {...stylex.props(styles.button, styles.segment, value === v && styles.on)}
        >
          {text}
        </button>
      ))}
    </span>
  );
}

const THUMB_COLORS = { shape: "#72e36c", line: "#ffd23f", eraser: "#ff5b7c", image: "#5fd4ff" } as const;

/** A tiny render of a layer's own cells: shapes green, lines yellow, erasers red, images blue. */
export function LayerThumb({ layer, size = 32 }: { layer: Layer; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const grid = layerGrid(layer);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    if (!grid.width) return;
    const cell = (size - 4) / Math.max(grid.width, grid.height);
    const ox = (size - grid.width * cell) / 2, oy = (size - grid.height * cell) / 2;
    ctx.fillStyle = THUMB_COLORS[layer.kind];
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.cells[y * grid.width + x]) ctx.fillRect(ox + x * cell, oy + y * cell, Math.max(1, cell + 0.3), Math.max(1, cell + 0.3));
      }
    }
  }, [layer, size]);
  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ width: size, height: size }}
      {...stylex.props(styles.thumb, !layer.visible && styles.thumbHidden)}
    />
  );
}

export const styles = stylex.create({
  stack: { display: "flex", flexDirection: "column", gap: 12 },
  row: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 },
  grow: { flexGrow: 1, minWidth: 0 },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    fontWeight: 800,
    color: colors.inkSoft,
  },
  field: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: 800,
    color: colors.inkFaint,
  },
  input: {
    paddingBlock: 6,
    paddingInline: 8,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: { default: colors.line, ":focus": colors.diamond },
    borderRadius: 3,
    outline: "none",
    backgroundColor: colors.panelSunk,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: 700,
  },
  numberInput: { width: 68, fontFamily: fonts.mono },
  button: {
    paddingBlock: 6,
    paddingInline: 10,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
    borderRadius: 3,
    backgroundColor: { default: colors.panelSunk, ":hover": colors.panelRaised },
    color: colors.inkSoft,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    opacity: { default: 1, ":disabled": 0.4 },
  },
  on: { borderColor: colors.diamond, color: colors.diamond },
  danger: { color: colors.redstone },
  segmented: { display: "inline-flex" },
  segment: {
    borderRadius: 0,
    marginLeft: { default: -2, ":first-child": 0 },
  },
  muted: { margin: 0, fontSize: 12, lineHeight: 1.45, color: colors.inkFaint },
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
  warn: { backgroundColor: colors.redstone, color: colors.skyDeep },
  thumb: { display: "block", flexShrink: 0, borderRadius: 2, backgroundColor: colors.panelSunk },
  thumbHidden: { opacity: 0.35 },
});
