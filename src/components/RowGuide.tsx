import { CheckIcon } from "lucide-react";
import { memo } from "react";
import { rowCount, rowSegments, type Grid } from "../shapes/grid";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

interface Props {
  grid: Grid;
  highlightRow: number | null;
  doneRows: ReadonlySet<number>;
  onHoverRow: (row: number | null) => void;
  onToggleRow: (row: number) => void;
}

/**
 * Row-by-row placement instructions: how many blocks to skip, then place,
 * reading from the left edge. Click a row to tick it off.
 */
export function RowGuide({ grid, highlightRow, doneRows, onHoverRow, onToggleRow }: Props) {
  return (
    <ol
      className="m-0 flex max-h-[min(68vh,760px)] list-none flex-col gap-[3px] overflow-y-auto p-0 pr-1"
      onPointerLeave={() => onHoverRow(null)}
    >
      {Array.from({ length: grid.height }, (_, y) => (
        <Row
          key={y}
          grid={grid}
          y={y}
          highlighted={highlightRow === y}
          done={doneRows.has(y)}
          onHoverRow={onHoverRow}
          onToggleRow={onToggleRow}
        />
      ))}
    </ol>
  );
}

const Row = memo(function Row({
  grid,
  y,
  highlighted,
  done,
  onHoverRow,
  onToggleRow,
}: {
  grid: Grid;
  y: number;
  highlighted: boolean;
  done: boolean;
  onHoverRow: (row: number | null) => void;
  onToggleRow: (row: number) => void;
}) {
  const segments = rowSegments(grid, y);
  return (
    <li>
      <Toggle
        pressed={done}
        onPointerEnter={() => onHoverRow(y)}
        onFocus={() => onHoverRow(y)}
        onPressedChange={() => onToggleRow(y)}
        data-highlighted={highlighted || undefined}
        // Row layout on the toggle; a ticked row fades, the highlighted row gets a gold edge.
        className="grid w-full grid-cols-[18px_30px_1fr_auto] gap-2 rounded-[4px] border-transparent px-2 py-[5px] text-left font-normal whitespace-normal text-foreground data-highlighted:border-gold data-highlighted:bg-accent data-pressed:border-transparent data-pressed:text-foreground data-pressed:opacity-55 data-pressed:data-highlighted:border-gold"
      >
        <span
          className={cn(
            "grid size-4 place-items-center rounded-[2px] border-2 border-input text-sky-deep [&_svg]:size-2.5! [&_svg]:stroke-[4]",
            done && "border-grass bg-grass",
          )}
        >
          {done && <CheckIcon />}
        </span>
        <span className="text-right font-mono text-xs text-muted-foreground">{y + 1}</span>
        <span className="flex min-w-0 flex-wrap gap-[3px]">
          {segments.map((s, i) => (
            <span
              key={i}
              className={cn(
                "rounded-[2px] px-[5px] py-px font-mono text-xs leading-[1.5] font-bold",
                s.filled ? "bg-grass text-sky-deep shadow-[inset_0_-2px_0_var(--grass-dark)]" : "text-muted-foreground",
              )}
            >
              {s.filled ? s.length : `·${s.length}`}
            </span>
          ))}
        </span>
        <span className="font-pixel text-[10px] text-gold">{rowCount(grid, y)}</span>
      </Toggle>
    </li>
  );
});
