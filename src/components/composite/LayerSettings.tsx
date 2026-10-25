import * as stylex from "@stylexjs/stylex";
import {
  CANVAS_MAX,
  CANVAS_MIN,
  isOffCanvas,
  lineEndpoints,
  setLineEndpoints,
  type Layer,
  type LineLayer,
} from "../../composite/composite";
import { centreLayer, moveLayer } from "../../composite/edit";
import type { CompositeApi } from "../../composite/useComposite";
import { getShape, SHAPES } from "../../shapes";
import { fillParams } from "../../shapes/fill";
import type { Point } from "../../shapes/raster";
import { defaultValues, resolveValues, type ParamValue } from "../../shapes/types";
import { ParamControls } from "../ParamControls";
import { NumberField, styles as ui } from "./controls";

/** The selected layer's settings: name, visibility, position, centring, its own params, then duplicate and delete. */
export function LayerSettings({ api, layer }: { api: CompositeApi; layer: Layer }) {
  const { canvas } = api.composite;
  const set = (change: (l: Layer) => Layer, merge?: string) => api.updateLayer(layer.id, change, merge);
  const centre = (h: boolean, v: boolean) => set(l => centreLayer(l, canvas, h, v));

  return (
    <div {...stylex.props(ui.stack)}>
      <div {...stylex.props(ui.row)}>
        <input
          aria-label="Layer name"
          value={layer.name}
          onChange={e => set(l => ({ ...l, name: e.target.value }), "name")}
          {...stylex.props(ui.input, ui.grow)}
        />
        <button type="button" onClick={() => set(l => ({ ...l, visible: !l.visible }))} {...stylex.props(ui.button)}>
          {layer.visible ? "Hide" : "Show"}
        </button>
      </div>

      <div {...stylex.props(ui.row)}>
        <NumberField label="x" value={layer.x} onChange={x => set(l => moveLayer(l, x, l.y), "x")} />
        <NumberField label="y" value={layer.y} onChange={y => set(l => moveLayer(l, l.x, y), "y")} />
        {isOffCanvas(layer, canvas) && <span {...stylex.props(ui.badge, ui.warn)}>Off canvas</span>}
      </div>

      <div {...stylex.props(ui.row)}>
        <button type="button" title="Centre on the canvas" onClick={() => centre(true, true)} {...stylex.props(ui.button)}>
          ✛ Centre
        </button>
        <button type="button" title="Centre left to right" onClick={() => centre(true, false)} {...stylex.props(ui.button)}>
          ⇔ Horizontally
        </button>
        <button type="button" title="Centre top to bottom" onClick={() => centre(false, true)} {...stylex.props(ui.button)}>
          ⇕ Vertically
        </button>
      </div>

      {layer.kind === "shape" && <ShapeSettings api={api} layer={layer} />}
      {layer.kind === "line" && <LineSettings api={api} layer={layer} />}
      {layer.kind === "eraser" && (
        <p {...stylex.props(ui.muted)}>
          {layer.cells.length
            ? `${layer.cells.length} painted ${layer.cells.length === 1 ? "cell" : "cells"}, tinted red while selected. Paint with the Eraser tool to add more, or switch it to Restore to take some back.`
            : "Empty: every cell has been restored. Paint with the Eraser tool, or delete the layer."}
        </p>
      )}

      <div {...stylex.props(ui.row)}>
        <button type="button" onClick={() => api.duplicate(layer.id)} {...stylex.props(ui.button)}>
          Duplicate
        </button>
        <button type="button" onClick={() => api.deleteLayer(layer.id)} {...stylex.props(ui.button, ui.danger)}>
          Delete
        </button>
      </div>
    </div>
  );
}

function ShapeSettings({ api, layer }: { api: CompositeApi; layer: Extract<Layer, { kind: "shape" }> }) {
  const shape = getShape(layer.shapeId);
  const set = (change: (l: typeof layer) => typeof layer, merge?: string) =>
    api.updateLayer(layer.id, l => (l.kind === "shape" ? change(l) : l), merge);
  const setValue = (key: string, value: ParamValue) => set(l => ({ ...l, values: { ...l.values, [key]: value } }), key);

  return (
    <>
      <label {...stylex.props(ui.label)}>
        Shape
        <select
          value={shape.id}
          onChange={e => {
            // A new shape starts from its own defaults but keeps the layer's Fill.
            const next = getShape(e.target.value);
            const fill = resolveValues(fillParams, layer.values);
            set(l => ({ ...l, shapeId: next.id, values: { ...defaultValues(next.params), ...fill } }));
          }}
          {...stylex.props(ui.input)}
        >
          {SHAPES.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <p {...stylex.props(ui.muted)}>{shape.description}</p>
      <ParamControls params={shape.params} values={resolveValues(shape.params, layer.values)} onChange={setValue} />
      <ParamControls params={fillParams} values={resolveValues(fillParams, layer.values)} onChange={setValue} />
    </>
  );
}

function LineSettings({ api, layer }: { api: CompositeApi; layer: LineLayer }) {
  const [a, b] = lineEndpoints(layer);
  const set = (end: "a" | "b", axis: "x" | "y", v: number) => {
    const move = (p: Point, which: "a" | "b") => (which === end ? { ...p, [axis]: v } : p);
    api.updateLayer(layer.id, l => (l.kind === "line" ? setLineEndpoints(l, move(a, "a"), move(b, "b")) : l), `${end}${axis}`);
  };
  return (
    <>
      {(["a", "b"] as const).map(end => {
        const p = end === "a" ? a : b;
        return (
          <div key={end} {...stylex.props(ui.row)}>
            <span {...stylex.props(ui.label)}>{end.toUpperCase()}</span>
            <NumberField label="x" value={p.x} onChange={v => set(end, "x", v)} />
            <NumberField label="y" value={p.y} onChange={v => set(end, "y", v)} />
          </div>
        );
      })}
      <p {...stylex.props(ui.muted)}>
        Endpoints are canvas x/y. Drag the yellow handles with the Move tool; Shift snaps to 0°, 45° or 90°.
      </p>
    </>
  );
}

/** Shown when no layer is selected. */
export function CanvasSettings({ api }: { api: CompositeApi }) {
  const { canvas } = api.composite;
  return (
    <div {...stylex.props(ui.stack)}>
      <div {...stylex.props(ui.row)}>
        <span {...stylex.props(ui.label)}>Canvas</span>
        <NumberField
          label="w"
          value={canvas.width}
          min={CANVAS_MIN}
          max={CANVAS_MAX}
          onChange={width => api.resize({ ...canvas, width }, "width")}
        />
        <span {...stylex.props(ui.muted)}>×</span>
        <NumberField
          label="h"
          value={canvas.height}
          min={CANVAS_MIN}
          max={CANVAS_MAX}
          onChange={height => api.resize({ ...canvas, height }, "height")}
        />
      </div>
      <p {...stylex.props(ui.muted)}>
        {CANVAS_MIN}–{CANVAS_MAX} blocks a side. Resizing keeps the top-left fixed; blocks pushed off the edge come
        back if you make it bigger again.
      </p>
      <p {...stylex.props(ui.muted)}>
        {api.composite.layers.length
          ? "Select a layer in the Layers panel, or Ctrl-click it on the canvas, to edit it."
          : "Drag a shape from the bar above onto the canvas to start."}
      </p>
    </div>
  );
}
