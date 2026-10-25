/**
 * PROTOTYPE, throwaway. The selected layer's settings, reusing ParamControls.
 * Every variant mounts this somewhere different; the contents stay the same so
 * the comparison is about placement, not form design.
 */
import * as stylex from "@stylexjs/stylex";
import { useMemo } from "react";
import { ParamControls } from "../components/ParamControls";
import { fillParams } from "../shapes/fill";
import { trim, trimOffset, type Grid } from "../shapes/grid";
import { getShape, SHAPES } from "../shapes";
import { defaultValues, resolveValues, type ParamDef } from "../shapes/types";
import { colors, fonts } from "../theme/tokens.stylex";
import { flatten, isOffCanvas, moveBy, position, type Composite, type Layer } from "./engine";
import type { CompositeApi } from "./useComposite";

export function LayerSettings({ api, layer, compact }: { api: CompositeApi; layer: Layer; compact?: boolean }) {
  const set = (fn: (l: Layer) => Layer, merge?: string) => api.updateLayer(layer.id, fn, merge);
  const pos = position(layer);
  const off = isOffCanvas(api.composite, layer);

  return (
    <div {...stylex.props(styles.stack)}>
      <div {...stylex.props(styles.row)}>
        <input
          aria-label="Layer name"
          value={layer.name}
          onChange={e => set(l => ({ ...l, name: e.target.value }), "name")}
          {...stylex.props(styles.text, styles.grow)}
        />
        <button type="button" onClick={() => set(l => ({ ...l, visible: !l.visible }))} {...stylex.props(styles.btn)}>
          {layer.visible ? "Hide" : "Show"}
        </button>
      </div>

      <div {...stylex.props(styles.row)}>
        <Num label="x" value={pos.x} onChange={v => set(l => moveBy(l, v - pos.x, 0), "x")} />
        <Num label="y" value={pos.y} onChange={v => set(l => moveBy(l, 0, v - pos.y), "y")} />
        {off && <span {...stylex.props(styles.warn)}>Off canvas</span>}
      </div>

      {layer.kind === "shape" && (
        <>
          <label {...stylex.props(styles.label)}>
            Shape
            <select
              value={layer.shapeId}
              onChange={e => {
                const s = getShape(e.target.value);
                set(l => (l.kind === "shape" ? { ...l, shapeId: s.id, values: defaultValues(s.params) } : l));
              }}
              {...stylex.props(styles.text)}
            >
              {SHAPES.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          {!compact && <p {...stylex.props(styles.muted)}>{getShape(layer.shapeId).description}</p>}
          <ParamControls
            params={getShape(layer.shapeId).params}
            values={resolveValues(getShape(layer.shapeId).params, layer.values)}
            onChange={(k, v) => set(l => (l.kind === "shape" ? { ...l, values: { ...l.values, [k]: v } } : l), k)}
          />
          <ParamControls
            params={fillParams as ParamDef[]}
            values={resolveValues(fillParams, layer.fill)}
            onChange={(k, v) => set(l => (l.kind === "shape" ? { ...l, fill: { ...l.fill, [k]: v } } : l), k)}
          />
        </>
      )}

      {layer.kind === "line" && (
        <>
          <div {...stylex.props(styles.row)}>
            <span {...stylex.props(styles.label)}>A</span>
            <Num label="x" value={layer.a.x} onChange={v => set(l => (l.kind === "line" ? { ...l, a: { ...l.a, x: v } } : l), "ax")} />
            <Num label="y" value={layer.a.y} onChange={v => set(l => (l.kind === "line" ? { ...l, a: { ...l.a, y: v } } : l), "ay")} />
          </div>
          <div {...stylex.props(styles.row)}>
            <span {...stylex.props(styles.label)}>B</span>
            <Num label="x" value={layer.b.x} onChange={v => set(l => (l.kind === "line" ? { ...l, b: { ...l.b, x: v } } : l), "bx")} />
            <Num label="y" value={layer.b.y} onChange={v => set(l => (l.kind === "line" ? { ...l, b: { ...l.b, y: v } } : l), "by")} />
          </div>
          <p {...stylex.props(styles.muted)}>Drag the yellow handles with the Move tool. Shift snaps to 45°.</p>
        </>
      )}

      {layer.kind === "eraser" && (
        <p {...stylex.props(styles.muted)}>
          {layer.cells.length
            ? `${layer.cells.length} cells painted (tinted red while selected). Use the eraser tool to add more, or Restore to take them back.`
            : "Empty: every cell has been restored. Paint with the eraser tool, or delete the layer."}
        </p>
      )}

      <div {...stylex.props(styles.row)}>
        <button type="button" onClick={() => api.duplicateLayer(layer.id)} {...stylex.props(styles.btn)}>Duplicate</button>
        <button type="button" onClick={() => api.removeLayer(layer.id)} {...stylex.props(styles.btn, styles.danger)}>Delete</button>
      </div>
    </div>
  );
}

export function CanvasSize({ api }: { api: CompositeApi }) {
  const { width, height } = api.composite;
  const clamp = (v: number) => Math.max(8, Math.min(256, Math.round(v) || 8));
  return (
    <div {...stylex.props(styles.row)}>
      <span {...stylex.props(styles.label)}>Canvas</span>
      <Num label="w" value={width} onChange={v => api.resize(clamp(v), height)} />
      <span {...stylex.props(styles.muted)}>×</span>
      <Num label="h" value={height} onChange={v => api.resize(width, clamp(v))} />
    </div>
  );
}

export function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label {...stylex.props(styles.num)}>
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => Number.isFinite(e.target.valueAsNumber) && onChange(e.target.valueAsNumber)}
        {...stylex.props(styles.text, styles.numInput)}
      />
    </label>
  );
}

/** The trimmed plan the stats and row guide describe, plus where it sits on the canvas. */
export function usePlan(c: Composite): { grid: Grid; offset: { x: number; y: number } } {
  return useMemo(() => {
    const full = flatten(c);
    return { grid: trim(full), offset: trimOffset(full) };
  }, [c]);
}

export const styles = stylex.create({
  stack: { display: "flex", flexDirection: "column", gap: 12 },
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  grow: { flexGrow: 1, minWidth: 0 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 800, color: colors.inkSoft },
  text: {
    paddingBlock: 6,
    paddingInline: 8,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
    borderRadius: 3,
    backgroundColor: colors.panelSunk,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: 700,
  },
  num: { display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 800, color: colors.inkFaint },
  numInput: { width: 64, fontFamily: fonts.mono },
  btn: {
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
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    opacity: { default: 1, ":disabled": 0.4 },
  },
  on: { borderColor: colors.diamond, color: colors.diamond },
  danger: { color: colors.redstone },
  muted: { margin: 0, fontSize: 12, color: colors.inkFaint, lineHeight: 1.45 },
  warn: {
    paddingBlock: 2,
    paddingInline: 6,
    borderRadius: 3,
    backgroundColor: colors.redstone,
    color: colors.skyDeep,
    fontSize: 11,
    fontWeight: 900,
  },
});
