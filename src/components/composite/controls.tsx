import { useEffect, useRef, useState } from "react";
import { layerGrid, type Layer } from "../../composite/composite";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
    <Label className="gap-1.5 font-mono text-xs text-muted-foreground">
      <span>{label}</span>
      <Input
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
        className="w-[68px] font-mono"
      />
    </Label>
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
  const group = (
    <ToggleGroup aria-label={label} spacing={0} value={[value]} onValueChange={v => v[0] && onChange(v[0] as T)}>
      {options.map(([v, text]) => (
        <ToggleGroupItem key={v} value={v} disabled={disabled.includes(v)}>
          {text}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
  if (!title) return group;
  return (
    <Tooltip>
      <TooltipTrigger render={group} />
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
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
      className={cn("block shrink-0 rounded-[2px] bg-secondary", !layer.visible && "opacity-35")}
    />
  );
}
