import { CrosshairIcon, MoveHorizontalIcon, MoveVerticalIcon } from "lucide-react";
import {
  CANVAS_MAX,
  CANVAS_MIN,
  isOffCanvas,
  layerGrid,
  lineEndpoints,
  setLineEndpoints,
  type ImageLayer,
  type Layer,
  type LineLayer,
} from "../../composite/composite";
import { centreLayer, layerCentre, moveLayer, placeCentre, resizeImageLayer } from "../../composite/edit";
import { imageParams } from "../../composite/image";
import type { CompositeApi } from "../../composite/useComposite";
import { getShape, SHAPES } from "../../shapes";
import { fillParams } from "../../shapes/fill";
import type { Point } from "../../shapes/raster";
import { defaultValues, resolveValues, type ParamValue } from "../../shapes/types";
import { ParamControls } from "../ParamControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NumberField } from "./controls";

const STACK = "flex flex-col gap-3";
const ROW = "flex flex-wrap items-center gap-2";
const ROW_LABEL = "text-[13px] font-extrabold text-secondary-foreground";

const SHAPE_ITEMS = SHAPES.map(s => ({ value: s.id, label: s.name }));

/** The selected layer's settings: name, visibility, position, centring, its own params, then duplicate and delete. */
export function LayerSettings({ api, layer }: { api: CompositeApi; layer: Layer }) {
  const { canvas } = api.composite;
  const set = (change: (l: Layer) => Layer, merge?: string) => api.updateLayer(layer.id, change, merge);
  const centre = (h: boolean, v: boolean) => set(l => centreLayer(l, canvas, h, v));

  return (
    <div className={STACK}>
      <div className={ROW}>
        <Input
          aria-label="Layer name"
          value={layer.name}
          onChange={e => set(l => ({ ...l, name: e.target.value }), "name")}
          className="w-auto grow"
        />
        <Button onClick={() => set(l => ({ ...l, visible: !l.visible }))}>{layer.visible ? "Hide" : "Show"}</Button>
      </div>

      <div className={ROW}>
        {layer.kind === "image" ? (
          // Images are placed by their centre block, which stays put while resizing.
          <>
            <NumberField label="centre x" value={layerCentre(layer).x} onChange={x => set(l => placeCentre(l, { ...layerCentre(l), x }), "x")} />
            <NumberField label="centre y" value={layerCentre(layer).y} onChange={y => set(l => placeCentre(l, { ...layerCentre(l), y }), "y")} />
          </>
        ) : (
          <>
            <NumberField label="x" value={layer.x} onChange={x => set(l => moveLayer(l, x, l.y), "x")} />
            <NumberField label="y" value={layer.y} onChange={y => set(l => moveLayer(l, l.x, y), "y")} />
          </>
        )}
        {isOffCanvas(layer, canvas) && <Badge variant="destructive">Off canvas</Badge>}
      </div>

      <div className={ROW}>
        <Tooltip>
          <TooltipTrigger render={<Button onClick={() => centre(true, true)} />}>
            <CrosshairIcon data-icon="inline-start" />
            Centre
          </TooltipTrigger>
          <TooltipContent>Centre on the canvas</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button onClick={() => centre(true, false)} />}>
            <MoveHorizontalIcon data-icon="inline-start" />
            Horizontally
          </TooltipTrigger>
          <TooltipContent>Centre left to right</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button onClick={() => centre(false, true)} />}>
            <MoveVerticalIcon data-icon="inline-start" />
            Vertically
          </TooltipTrigger>
          <TooltipContent>Centre top to bottom</TooltipContent>
        </Tooltip>
      </div>

      {layer.kind === "shape" && <ShapeSettings api={api} layer={layer} />}
      {layer.kind === "line" && <LineSettings api={api} layer={layer} />}
      {layer.kind === "image" && <ImageSettings api={api} layer={layer} />}
      {layer.kind === "eraser" && (
        <FieldDescription>
          {layer.cells.length
            ? `${layer.cells.length} painted ${layer.cells.length === 1 ? "cell" : "cells"}, tinted red while selected. Paint with the Eraser tool to add more, or switch it to Restore to take some back.`
            : "Empty: every cell has been restored. Paint with the Eraser tool, or delete the layer."}
        </FieldDescription>
      )}

      <div className={ROW}>
        <Button onClick={() => api.duplicate(layer.id)}>Duplicate</Button>
        <Button variant="destructive" onClick={() => api.deleteLayer(layer.id)}>
          Delete
        </Button>
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
      <Field>
        <FieldLabel className={ROW_LABEL}>Shape</FieldLabel>
        <Select
          items={SHAPE_ITEMS}
          value={shape.id}
          onValueChange={id => {
            if (!id) return;
            // A new shape starts from its own defaults but keeps the layer's Fill.
            const next = getShape(id);
            const fill = resolveValues(fillParams, layer.values);
            set(l => ({ ...l, shapeId: next.id, values: { ...defaultValues(next.params), ...fill } }));
          }}
        >
          <SelectTrigger aria-label="Shape">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SHAPE_ITEMS.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <FieldDescription>{shape.description}</FieldDescription>
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
          <div key={end} className={ROW}>
            <span className={ROW_LABEL}>{end.toUpperCase()}</span>
            <NumberField label="x" value={p.x} onChange={v => set(end, "x", v)} />
            <NumberField label="y" value={p.y} onChange={v => set(end, "y", v)} />
          </div>
        );
      })}
      <FieldDescription>
        Endpoints are canvas x/y. Drag the yellow handles with the Move tool; Shift snaps to 0°, 45° or 90°.
      </FieldDescription>
    </>
  );
}

function ImageSettings({ api, layer }: { api: CompositeApi; layer: ImageLayer }) {
  const setValue = (key: string, value: ParamValue) =>
    api.updateLayer(layer.id, l => (l.kind === "image" ? resizeImageLayer(l, { ...l.values, [key]: value }) : l), key);
  const values = resolveValues(imageParams, layer.values);
  const grid = layerGrid(layer);
  return (
    <>
      <FieldDescription>
        <Badge>experimental</Badge> Traced from an imported picture · {grid.width} ×{" "}
        {grid.height} blocks
      </FieldDescription>
      <ParamControls params={imageParams} values={values} onChange={setValue} />
      {values.trace === "silhouette" && (
        <ParamControls params={fillParams} values={resolveValues(fillParams, layer.values)} onChange={setValue} />
      )}
    </>
  );
}

/** Shown when no layer is selected. */
export function CanvasSettings({ api }: { api: CompositeApi }) {
  const { canvas } = api.composite;
  return (
    <div className={STACK}>
      <div className={ROW}>
        <span className={ROW_LABEL}>Canvas</span>
        <NumberField
          label="w"
          value={canvas.width}
          min={CANVAS_MIN}
          max={CANVAS_MAX}
          onChange={width => api.resize({ ...canvas, width }, "width")}
        />
        <span className="text-xs text-muted-foreground">×</span>
        <NumberField
          label="h"
          value={canvas.height}
          min={CANVAS_MIN}
          max={CANVAS_MAX}
          onChange={height => api.resize({ ...canvas, height }, "height")}
        />
      </div>
      <FieldDescription>
        {CANVAS_MIN}–{CANVAS_MAX} blocks a side. Resizing keeps the top-left fixed; blocks pushed off the edge come
        back if you make it bigger again.
      </FieldDescription>
      <FieldDescription>
        {api.composite.layers.length
          ? "Select a layer in the Layers panel, or Ctrl-click it on the canvas, to edit it."
          : "Drag a shape from the bar above onto the canvas to start."}
      </FieldDescription>
    </div>
  );
}
