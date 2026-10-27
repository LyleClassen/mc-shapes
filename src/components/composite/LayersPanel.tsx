import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { isOffCanvas } from "../../composite/composite";
import { describeLayer } from "../../composite/edit";
import type { CompositeApi } from "../../composite/useComposite";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { LayerThumb } from "./controls";

const LAYER_TYPE = "application/x-composite-layer";

/** Photoshop-style layer list: top layer first, an eye per row, click to select, drag rows to reorder. */
export function LayersPanel({ api }: { api: CompositeApi }) {
  const { layers, canvas } = api.composite;
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  if (!layers.length) return <FieldDescription>No layers yet. Drag a shape onto the canvas.</FieldDescription>;

  return (
    <>
      <ol className="m-0 flex list-none flex-col gap-[3px] p-0">
        {layers
          .map((layer, index) => ({ layer, index }))
          .reverse()
          .map(({ layer, index }) => (
            <li
              key={layer.id}
              draggable
              onDragStart={e => {
                e.dataTransfer.setData(LAYER_TYPE, layer.id);
                e.dataTransfer.effectAllowed = "move";
                setDragId(layer.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDragOver={e => {
                if (!dragId) return;
                e.preventDefault();
                setOverId(layer.id);
              }}
              onDrop={e => {
                e.preventDefault();
                if (dragId && dragId !== layer.id) api.reorder(dragId, index);
                setDragId(null);
                setOverId(null);
              }}
              onClick={() => api.select(layer.id === api.selectedId ? null : layer.id)}
              className={cn(
                "flex cursor-grab items-center gap-2 rounded-sm border-2 border-transparent bg-secondary p-1.5 select-none hover:bg-accent",
                layer.id === api.selectedId && "border-ring bg-accent",
                dragId === layer.id && "opacity-40",
                overId === layer.id && dragId !== layer.id && "border-t-gold",
              )}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                aria-pressed={layer.visible}
                onClick={e => {
                  e.stopPropagation();
                  api.updateLayer(layer.id, l => ({ ...l, visible: !l.visible }));
                }}
                className={cn(!layer.visible && "text-muted-foreground")}
              >
                {layer.visible ? <EyeIcon /> : <EyeOffIcon />}
              </Button>
              <LayerThumb layer={layer} />
              <span className="flex min-w-0 grow flex-col">
                <b className="truncate text-[13px] text-foreground">{layer.name}</b>
                <span className="truncate text-[11px] text-muted-foreground">{describeLayer(layer)}</span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                {!layer.visible && <Badge>hidden</Badge>}
                {isOffCanvas(layer, canvas) && (layer.kind !== "eraser" || layer.cells.length > 0) && (
                  <Badge variant="destructive">off canvas</Badge>
                )}
                {layer.kind === "eraser" && !layer.cells.length && <Badge>empty</Badge>}
              </span>
            </li>
          ))}
      </ol>
      <FieldDescription>Top layer first. Each layer sees only the layers below it. Drag rows to reorder.</FieldDescription>
    </>
  );
}
