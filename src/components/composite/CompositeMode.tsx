import { ChevronRightIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { flatten } from "../../composite/composite";
import { useComposite } from "../../composite/useComposite";
import { getSkin, SKINS } from "../../render/skins";
import type { CenterMarks } from "../../shapes/center";
import { centerSpan, countBlocks, type Grid } from "../../shapes/grid";
import { mirrorAxes } from "../../shapes/symmetry";
import { highlight, highlightParam, type HighlightMode } from "../../shapes/patterns";
import type { Point } from "../../shapes/raster";
import { Panel } from "../Panel";
import { ParamControls } from "../ParamControls";
import { PatternLegend, recolour } from "../PatternLegend";
import { RowGuide } from "../RowGuide";
import { SkinPicker } from "../SkinPicker";
import { StatsBar } from "../StatsBar";
import { CompositeStage } from "./CompositeStage";
import { CompositeToolbar, EraserOptions } from "./CompositeToolbar";
import { LayerSettings, CanvasSettings } from "./LayerSettings";
import { LayersPanel } from "./LayersPanel";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/** View settings shared with Shapes mode. None of them are undoable. */
export interface SharedView {
  skinId: string;
  setSkinId: (id: string) => void;
  highlightMode: HighlightMode;
  setHighlightMode: (mode: HighlightMode) => void;
  patternColors: Record<string, string>;
  setPatternColors: (colors: Record<string, string>) => void;
}

/**
 * Composite mode: tools and the shape palette on top, the selected layer's
 * settings on the left, the stage with its stats and row guide in the middle,
 * and the Layers panel on the right. Kept mounted while Shapes mode is showing,
 * so the undo history survives the trip; `active` says which mode is showing.
 */
export function CompositeMode({ active, view }: { active: boolean; view: SharedView }) {
  const api = useComposite(active);
  const flat = useMemo(() => flatten(api.composite), [api.composite]);
  const traced = useMemo(() => highlight(flat.canvas, view.highlightMode), [flat, view.highlightMode]);
  const outline = useMemo(() => recolour(traced, view.patternColors), [traced, view.patternColors]);

  const [hover, setHover] = useState<Point | null>(null);
  const [listRow, setListRow] = useState<number | null>(null);
  const [done, setDone] = useState<{ plan: Grid | null; rows: ReadonlySet<number> }>({ plan: null, rows: new Set() });

  const { grid, origin } = flat;
  const doneRows = done.plan === grid ? done.rows : EMPTY_SET;
  // Rows count from the trimmed plan's top; the stage draws in canvas rows.
  const hoverRow = hover && hover.y - origin.y >= 0 && hover.y - origin.y < grid.height ? hover.y - origin.y : null;
  const planRow = listRow ?? hoverRow;
  const canvasDone = useMemo(() => new Set([...doneRows].map(y => y + origin.y)), [doneRows, origin.y]);
  // The centre of the trimmed plan, as in Shapes mode, moved into canvas coordinates.
  const center = useMemo((): CenterMarks | null => {
    if (!grid.width) return null;
    const x = centerSpan(grid.width), y = centerSpan(grid.height);
    return {
      x: { ...x, start: x.start + origin.x },
      y: { ...y, start: y.start + origin.y },
      mirror: mirrorAxes(grid),
      straight: [],
    };
  }, [grid, origin]);

  const toggleRow = useCallback(
    (row: number) =>
      setDone(prev => {
        const rows = new Set(prev.plan === grid ? prev.rows : []);
        if (rows.has(row)) rows.delete(row);
        else rows.add(row);
        return { plan: grid, rows };
      }),
    [grid],
  );

  const blocks = countBlocks(grid);

  return (
    <div className="flex flex-col gap-4">
      <CompositeToolbar api={api} />

      <div className="grid grid-cols-[330px_minmax(0,1fr)_300px] items-start gap-5 max-narrow:grid-cols-[300px_minmax(0,1fr)] max-phone:grid-cols-[minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col gap-5">
          <Panel title={api.selected ? api.selected.name || "Layer" : "Canvas"} accent="gold">
            {api.selected ? <LayerSettings key={api.selected.id} api={api} layer={api.selected} /> : <CanvasSettings api={api} />}
          </Panel>

          <Panel title="Block" accent="amethyst">
            <ParamControls
              params={[highlightParam]}
              values={{ highlight: view.highlightMode }}
              onChange={(_, value) => view.setHighlightMode(value as HighlightMode)}
            />
            <PatternLegend
              highlight={outline}
              mode={view.highlightMode}
              custom={view.patternColors}
              onChange={view.setPatternColors}
            />
            <SkinPicker skins={SKINS} selected={view.skinId} onSelect={view.setSkinId} />
          </Panel>
        </aside>

        <section className="flex min-w-0 flex-col gap-3.5">
          {api.tool === "eraser" && <EraserOptions api={api} />}
          <CompositeStage
            api={api}
            canvas={flat.canvas}
            center={center}
            skin={getSkin(view.skinId)}
            highlight={outline}
            highlightRow={planRow === null ? null : planRow + origin.y}
            doneRows={canvasDone}
            onHover={setHover}
          />
          <StatsBar blocks={blocks} solidBlocks={blocks} width={grid.width} height={grid.height} />
          <Collapsible render={<Card className="gap-0 px-4 py-3" />}>
            <CollapsibleTrigger className="group/trigger flex w-full items-center gap-2.5 text-left font-pixel text-[11px] leading-[1.4] text-foreground uppercase">
              <ChevronRightIcon className="size-3.5 transition-transform group-data-panel-open/trigger:rotate-90" />
              Row guide
              <span className="font-sans text-xs font-bold text-muted-foreground normal-case">
                {grid.height ? `${grid.height} rows` : "no blocks yet"}
                {doneRows.size > 0 && ` · ${doneRows.size}/${grid.height} done`}
              </span>
            </CollapsibleTrigger>
            {/* The panel unmounts while closed, which matters: every row re-renders on each drag move. */}
            <CollapsibleContent className="mt-3 flex flex-col gap-2.5">
              <p className="m-0 text-xs text-muted-foreground">
                <span className="font-mono font-bold">·4</span> skip 4 ·{" "}
                <span className="rounded-[2px] bg-grass px-1 font-mono font-bold text-sky-deep">3</span> place 3 · rows
                count from the top of the trimmed plan · click a row to tick it off
              </p>
              <RowGuide
                grid={grid}
                highlightRow={planRow}
                doneRows={doneRows}
                onHoverRow={setListRow}
                onToggleRow={toggleRow}
              />
            </CollapsibleContent>
          </Collapsible>
        </section>

        <Panel title="Layers" accent="diamond" className="max-narrow:col-span-full">
          <LayersPanel api={api} />
        </Panel>
      </div>
    </div>
  );
}

const EMPTY_SET: ReadonlySet<number> = new Set();
