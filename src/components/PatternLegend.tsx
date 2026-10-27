import type { Highlight, HighlightMode } from "../shapes/patterns";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Custom colours are applied on top, so picking one doesn't re-trace the outline. */
export function recolour(traced: Highlight | null, custom: Record<string, string>): Highlight | null {
  return traced && { ...traced, legend: traced.legend.map(l => ({ ...l, color: custom[l.id] ?? l.color })) };
}

/**
 * One chip per colour on the outline: a step length, or step length × group
 * size. Click a chip to recolour it; `custom` holds every mode's picks.
 */
export function PatternLegend({
  highlight,
  mode,
  custom,
  onChange,
}: {
  highlight: Highlight | null;
  mode: HighlightMode;
  custom: Record<string, string>;
  onChange: (custom: Record<string, string>) => void;
}) {
  if (!highlight?.legend.length) return null;
  const { legend } = highlight;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {legend.map(({ id, label, color }) => (
        <Tooltip key={id}>
          <TooltipTrigger
            render={
              <label
                className="relative cursor-pointer rounded-sm px-[7px] py-0.5 font-mono text-xs font-extrabold shadow-[inset_0_-2px_0_rgba(0,0,0,0.3)] hover:shadow-[0_0_0_2px_var(--ink)]"
                style={{ backgroundColor: color, color: textOn(color) }}
              />
            }
          >
            {label}
            <input
              type="color"
              value={color}
              aria-label={`Pick a colour for ${label}`}
              onChange={e => onChange({ ...custom, [id]: e.target.value })}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </TooltipTrigger>
          <TooltipContent>Pick a colour for {label}</TooltipContent>
        </Tooltip>
      ))}
      {legend.some(l => l.id in custom) && (
        <Button
          variant="link"
          size="inline"
          onClick={() => onChange(Object.fromEntries(Object.entries(custom).filter(([id]) => !id.startsWith(`${mode}:`))))}
        >
          Reset colours
        </Button>
      )}
    </div>
  );
}

/** Dark text on light chips, white on dark ones. */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.45 ? "#0c0924" : "#ffffff";
}
