import { useEffect, useRef } from "react";
import { trim } from "../shapes/grid";
import { defaultValues, type ShapeModule } from "../shapes/types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  shapes: readonly ShapeModule[];
  selected: string;
  onSelect: (id: string) => void;
}

export function ShapePicker({ shapes, selected, onSelect }: Props) {
  return (
    <ToggleGroup
      aria-label="Shape"
      variant="card"
      className="grid w-full grid-cols-[repeat(auto-fill,minmax(88px,1fr))] items-stretch gap-2"
      value={[selected]}
      onValueChange={v => v[0] && onSelect(v[0])}
    >
      {shapes.map(shape => (
        <Tooltip key={shape.id}>
          <TooltipTrigger
            render={
              <ToggleGroupItem value={shape.id}>
                <ShapeThumb shape={shape} active={shape.id === selected} />
                <span className="text-center text-xs leading-[1.2]">{shape.name}</span>
              </ToggleGroupItem>
            }
          />
          <TooltipContent>{shape.description}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}

const THUMB = 44;

/** A tiny preview rendered from the shape module's own defaults. */
function ShapeThumb({ shape, active }: { shape: ShapeModule; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = THUMB * dpr;
    canvas.height = THUMB * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, THUMB, THUMB);

    const grid = trim(shape.build(defaultValues(shape.params)));
    const cell = THUMB / Math.max(grid.width, grid.height, 1);
    const ox = (THUMB - grid.width * cell) / 2;
    const oy = (THUMB - grid.height * cell) / 2;
    ctx.fillStyle = active ? "#ffd23f" : "#72e36c";
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.cells[y * grid.width + x]) ctx.fillRect(ox + x * cell, oy + y * cell, cell + 0.3, cell + 0.3);
      }
    }
  }, [shape, active]);

  return <canvas ref={ref} aria-hidden className="[image-rendering:pixelated]" style={{ width: THUMB, height: THUMB }} />;
}
