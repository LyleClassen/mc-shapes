import { EraserIcon, ImageUpIcon, MoveIcon, Redo2Icon, SlashIcon, Undo2Icon, type LucideIcon } from "lucide-react";
import { useMemo, useRef, type ReactElement } from "react";
import { EMPTY_COMPOSITE, newImageLayer, newShapeLayer } from "../../composite/composite";
import { loadImageMask } from "../../composite/image";
import type { CompositeApi, Tool, ToolOptions } from "../../composite/useComposite";
import { SHAPES } from "../../shapes";
import { fillParams } from "../../shapes/fill";
import { defaultValues } from "../../shapes/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SHAPE_TYPE } from "./CompositeStage";
import { LayerThumb, Segmented } from "./controls";

const TOOLS: readonly { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: "move", label: "Move", icon: MoveIcon },
  { id: "line", label: "Line", icon: SlashIcon },
  { id: "eraser", label: "Eraser", icon: EraserIcon },
];

/** Wraps a control in a hover hint. */
function Hint({ text, children }: { text: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

/** The top bar: tools, the shape palette (drag a shape onto the canvas), image import, then undo and redo. */
export function CompositeToolbar({ api }: { api: CompositeApi }) {
  // A thumbnail per shape at its defaults; the palette never changes.
  const palette = useMemo(
    () =>
      SHAPES.map(shape => ({
        shape,
        layer: newShapeLayer(EMPTY_COMPOSITE, shape.id, { ...defaultValues(shape.params), ...defaultValues(fillParams) }),
      })),
    [],
  );

  return (
    <Card className="flex-row flex-wrap items-center gap-2.5 p-2.5">
      <ToggleGroup
        aria-label="Tool"
        variant="tool"
        spacing={1}
        value={[api.tool]}
        onValueChange={v => v[0] && api.setTool(v[0] as Tool)}
      >
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <Hint key={id} text={label}>
            <ToggleGroupItem value={id}>
              <Icon data-icon="inline-start" />
              {label}
            </ToggleGroupItem>
          </Hint>
        ))}
      </ToggleGroup>

      <Separator orientation="vertical" />

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-extrabold text-grass">Drag a shape onto the canvas ↓</span>
        <div className="flex flex-wrap gap-1">
          {palette.map(({ shape, layer }) => (
            <Hint key={shape.id} text={`Drag a ${shape.name.toLowerCase()} onto the canvas`}>
              <span
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData(SHAPE_TYPE, shape.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => api.say(`Drag the ${shape.name.toLowerCase()} onto the canvas to place it`)}
                className="flex cursor-grab items-center gap-1.5 rounded-[4px] border-2 border-input bg-secondary px-2 py-1 text-[11px] font-extrabold text-secondary-foreground select-none hover:border-grass hover:bg-accent"
              >
                <LayerThumb layer={layer} size={26} />
                {shape.name}
              </span>
            </Hint>
          ))}
        </div>
      </div>

      <Separator orientation="vertical" />

      <ImageImport api={api} />

      <span className="grow" />

      <div className="flex gap-1">
        <Hint text="Undo (Ctrl+Z)">
          <span>
            <Button disabled={!api.canUndo} onClick={api.undo}>
              <Undo2Icon data-icon="inline-start" />
              Undo
            </Button>
          </span>
        </Hint>
        <Hint text="Redo (Ctrl+Shift+Z)">
          <span>
            <Button disabled={!api.canRedo} onClick={api.redo}>
              <Redo2Icon data-icon="inline-start" />
              Redo
            </Button>
          </span>
        </Hint>
      </div>
    </Card>
  );
}

/** Experimental: picks a picture file and adds it as a traced image layer. */
function ImageImport({ api }: { api: CompositeApi }) {
  const input = useRef<HTMLInputElement>(null);
  const load = async (file: File) => {
    try {
      const mask = await loadImageMask(file);
      if (mask) api.addLayer(newImageLayer(api.composite, mask, file.name));
      else api.say("Nothing to trace: that picture looks blank");
    } catch {
      api.say("Couldn't read that file as a picture");
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-extrabold text-grass">
        Trace a picture <Badge>experimental</Badge>
      </span>
      <Hint text="Import a picture and trace it into blocks">
        <Button onClick={() => input.current?.click()}>
          <ImageUpIcon data-icon="inline-start" />
          Import image
        </Button>
      </Hint>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          const file = e.target.files?.[0];
          // Cleared so picking the same file again still fires.
          e.target.value = "";
          if (file) void load(file);
        }}
      />
    </div>
  );
}

/** Brush or rectangle, brush size and Erase/Restore. Shown above the stage while the eraser is active. */
export function EraserOptions({ api }: { api: CompositeApi }) {
  const { options, selected } = api;
  const set = (patch: Partial<ToolOptions>) => api.setOptions(o => ({ ...o, ...patch }));
  const canRestore = selected?.kind === "eraser";

  return (
    <Card className="flex-row flex-wrap items-center gap-2 border-2 p-2 shadow-none">
      <Segmented
        label="Eraser shape"
        value={options.eraserShape}
        options={[["brush", "Brush"], ["rect", "Rectangle"]]}
        onChange={eraserShape => set({ eraserShape })}
      />
      {options.eraserShape === "brush" && (
        <Label className="gap-1.5 font-mono text-xs text-muted-foreground">
          Size
          <Slider
            tone="redstone"
            className="w-[110px]"
            min={1}
            max={8}
            value={options.brushSize}
            onValueChange={v => set({ brushSize: v as number })}
          />
          <b className="min-w-3 font-mono text-diamond">{options.brushSize}</b>
        </Label>
      )}
      <Segmented
        label="Erase or restore"
        value={canRestore ? options.eraseMode : "erase"}
        options={[["erase", "Erase"], ["restore", "Restore"]]}
        disabled={canRestore ? [] : ["restore"]}
        title={canRestore ? undefined : "Select an eraser layer to restore its cells"}
        onChange={eraseMode => set({ eraseMode })}
      />
      <span className="text-xs leading-[1.45] text-muted-foreground">
        {canRestore ? `Painting into "${selected.name}"` : "Each stroke makes a new eraser layer"}
      </span>
    </Card>
  );
}
