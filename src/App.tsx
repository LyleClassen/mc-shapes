import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { BlockStage, type Cell } from "./components/BlockStage";
import { CompositeMode } from "./components/composite/CompositeMode";
import { Panel } from "./components/Panel";
import { ParamControls } from "./components/ParamControls";
import { PatternLegend, recolour } from "./components/PatternLegend";
import { RowGuide } from "./components/RowGuide";
import { ShapePicker } from "./components/ShapePicker";
import { SkinPicker } from "./components/SkinPicker";
import { describeStacks, StatsBar } from "./components/StatsBar";
import { getSkin, SKINS } from "./render/skins";
import { applyFill, fillParams } from "./shapes/fill";
import { centerMarks, effectiveGuideMode, guideCells, guideParam, type GuideMode } from "./shapes/center";
import { highlight, highlightParam, isHighlightMode, type HighlightMode } from "./shapes/patterns";
import { countBlocks, isFilled, rowCount, trim, trimOffset, type Grid } from "./shapes/grid";
import { getShape, SHAPES } from "./shapes";
import { defaultValues, resolveValues, type ParamValue, type ParamValues } from "./shapes/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSessionState } from "./useSessionState";

type Mode = "shapes" | "composite";

export function App() {
  const [mode, setMode] = useSessionState<Mode>("mode", "shapes", v => v === "shapes" || v === "composite");
  const [shapeId, setShapeId] = useSessionState("shapeId", SHAPES[0]!.id, v => SHAPES.some(s => s.id === v));
  const [valuesById, setValuesById] = useSessionState<Record<string, ParamValues>>(
    "valuesById",
    () => Object.fromEntries(SHAPES.map(s => [s.id, defaultValues(s.params)])),
    isRecord,
  );
  const [fillInput, setFillInput] = useSessionState<ParamValues>("fill", () => defaultValues(fillParams), isRecord);
  const [skinId, setSkinId] = useSessionState("skinId", SKINS[0]!.id, v => SKINS.some(s => s.id === v));
  const [guideMode, setGuideMode] = useSessionState<GuideMode>(
    "guideMode",
    "straight",
    v => v === "off" || v === "straight" || v === "shaped",
  );
  const [highlightMode, setHighlightMode] = useSessionState<HighlightMode>("highlight", "off", isHighlightMode);
  const [patternColors, setPatternColors] = useSessionState<Record<string, string>>("patternColors", {}, isRecord);
  const [hover, setHover] = useState<Cell | null>(null);
  const [listRow, setListRow] = useState<number | null>(null);
  const [done, setDone] = useState<{ plan: string; rows: ReadonlySet<number> }>({ plan: "", rows: new Set() });

  const shape = getShape(shapeId);
  const values = resolveValues(shape.params, valuesById[shapeId]);
  const fill = resolveValues(fillParams, fillInput);
  const plan = JSON.stringify([shapeId, values, fill]);

  const { solid, grid, center } = useMemo(() => {
    const built = shape.build(values);
    const solid = trim(built);
    const grid = applyFill(solid, fill);
    return { solid, grid, center: centerMarks(grid, shape.center?.(values), trimOffset(built)) };
    // `plan` captures every input to the build.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const traced = useMemo(() => highlight(grid, highlightMode), [grid, highlightMode]);
  const outline = useMemo(() => recolour(traced, patternColors), [traced, patternColors]);

  const doneRows = done.plan === plan ? done.rows : EMPTY_SET;
  const highlightRow = listRow ?? hover?.y ?? null;

  const setParam = (key: string, value: ParamValue) =>
    setValuesById(prev => ({ ...prev, [shapeId]: { ...values, [key]: value } }));

  const toggleRow = useCallback(
    (row: number) =>
      setDone(prev => {
        const rows = new Set(prev.plan === plan ? prev.rows : []);
        if (rows.has(row)) rows.delete(row);
        else rows.add(row);
        return { plan, rows };
      }),
    [plan],
  );

  const blocks = countBlocks(grid);

  return (
    <TooltipProvider>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-7 py-7 max-phone:px-4">
        <header className="flex flex-wrap items-center gap-[18px]">
          <div className="flex items-end gap-1" aria-hidden>
            <span className={cn(LOGO_BLOCK, "bg-grass")} />
            <span className={cn(LOGO_BLOCK, "h-[30px] bg-gold [animation-delay:0.3s]")} />
            <span className={cn(LOGO_BLOCK, "bg-diamond [animation-delay:0.6s]")} />
          </div>
          <div>
            <h1 className="m-0 font-pixel font-bold text-[28px] leading-[1.3] text-foreground [text-shadow:3px_3px_0_var(--redstone),6px_6px_0_var(--shadow)] max-phone:text-lg">
              Shape Crafter
            </h1>
            <p className="mt-2 mb-0 text-[15px] font-bold text-secondary-foreground">
              Plan circles, triangles and more — block by block.
            </p>
          </div>
          <Tabs className="ml-auto" value={mode} onValueChange={v => setMode(v as Mode)}>
            <TabsList aria-label="Mode">
              <TabsTrigger value="shapes">Shapes</TabsTrigger>
              <TabsTrigger value="composite">Composite</TabsTrigger>
            </TabsList>
          </Tabs>
        </header>

        {/* Kept mounted so the composite's undo history survives a trip to Shapes mode. */}
        <div hidden={mode !== "composite"}>
          <CompositeMode
            active={mode === "composite"}
            view={{ skinId, setSkinId, highlightMode, setHighlightMode, patternColors, setPatternColors }}
          />
        </div>

        {mode === "shapes" && (
          <main className="grid grid-cols-[340px_minmax(0,1fr)_320px] items-start gap-5 max-narrow:grid-cols-[320px_minmax(0,1fr)] max-phone:grid-cols-[minmax(0,1fr)]">
            <aside className="flex min-w-0 flex-col gap-5">
              <Panel title="Shape" accent="grass">
                <ShapePicker shapes={SHAPES} selected={shapeId} onSelect={setShapeId} />
              </Panel>

              <Panel title={shape.name} accent="gold">
                <p className="m-0 text-sm text-secondary-foreground">{shape.description}</p>
                <ParamControls params={shape.params} values={values} onChange={setParam} />
                <ParamControls
                  params={[guideParam(center)]}
                  values={{ guides: effectiveGuideMode(guideMode, center) }}
                  onChange={(_, value) => setGuideMode(value as GuideMode)}
                />
                {shape.tip && (
                  <p className="m-0 rounded-[4px] border-l-4 border-gold bg-secondary px-3 py-2.5 text-[13px] leading-[1.45] text-secondary-foreground">
                    <b className="mr-1.5 font-pixel text-[9px] text-gold">Tip</b> {shape.tip}
                  </p>
                )}
              </Panel>

              <Panel title="Fill & block" accent="amethyst">
                <ParamControls
                  params={fillParams}
                  values={fill}
                  onChange={(key, value) => setFillInput(prev => ({ ...prev, [key]: value }))}
                />
                <ParamControls
                  params={[highlightParam]}
                  values={{ highlight: highlightMode }}
                  onChange={(_, value) => setHighlightMode(value as HighlightMode)}
                />
                <PatternLegend highlight={outline} mode={highlightMode} custom={patternColors} onChange={setPatternColors} />
                <SkinPicker skins={SKINS} selected={skinId} onSelect={setSkinId} />
              </Panel>
            </aside>

            <section className="flex min-w-0 flex-col gap-3.5">
              <StatsBar blocks={blocks} solidBlocks={countBlocks(solid)} width={grid.width} height={grid.height} />
              <BlockStage
                grid={grid}
                center={center}
                guides={guideCells(guideMode, center)}
                highlight={outline}
                skin={getSkin(skinId)}
                highlightRow={highlightRow}
                doneRows={doneRows}
                hover={hover}
                onHover={setHover}
              />
            </section>

            <Panel
              title="Row guide"
              accent="diamond"
              className="max-narrow:col-span-full"
              action={<CopyButton text={() => planText(shape.name, values, fill, grid)} />}
            >
              <p className="m-0 text-xs text-muted-foreground">
                <span className="font-mono font-bold">·4</span> skip 4 ·{" "}
                <span className="rounded-[2px] bg-grass px-1 font-mono font-bold text-sky-deep">3</span> place 3 · click a row to tick it off
                {doneRows.size > 0 && ` · ${doneRows.size}/${grid.height} done`}
              </p>
              <RowGuide
                grid={grid}
                highlightRow={highlightRow}
                doneRows={doneRows}
                onHoverRow={setListRow}
                onToggleRow={toggleRow}
              />
            </Panel>
          </main>
        )}

        <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
          <span>Shape Crafter is open source — contributions welcome.</span>
          <span aria-hidden>·</span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-bold text-foreground underline-offset-4 hover:underline"
          >
            View on GitHub
            <ExternalLinkIcon className="size-3" aria-hidden />
          </a>
          <span aria-hidden>·</span>
          <span>MIT licensed</span>
        </footer>
      </div>
    </TooltipProvider>
  );
}

const LOGO_BLOCK =
  "h-[22px] w-[22px] animate-bob border-[3px] border-shadow shadow-[inset_4px_4px_0_rgba(255,255,255,0.35),inset_-4px_-4px_0_rgba(0,0,0,0.3)]";

const REPO_URL = "https://github.com/LyleClassen/mc-shapes";

const EMPTY_SET: ReadonlySet<number> = new Set();

const isRecord = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);

function planText(name: string, values: ParamValues, fill: ParamValues, grid: Grid): string {
  const params = Object.entries(values).map(([k, v]) => `${k}=${v}`).join(", ");
  const fillText = fill.fill === "hollow" ? `outline, ${fill.thickness} thick` : "solid";
  const blocks = countBlocks(grid);
  const pad = String(grid.height).length;
  const rows = Array.from({ length: grid.height }, (_, y) => {
    let line = "";
    for (let x = 0; x < grid.width; x++) line += isFilled(grid, x, y) ? "█" : "·";
    return `${String(y + 1).padStart(pad)} ${line}  ${rowCount(grid, y)}`;
  });
  return [
    `${name} (${params}) — ${fillText}`,
    `${grid.width} × ${grid.height}, ${blocks} blocks (${describeStacks(blocks)})`,
    "",
    ...rows,
  ].join("\n");
}

function CopyButton({ text }: { text: () => string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      data-copied={copied || undefined}
      onClick={async () => {
        await navigator.clipboard.writeText(text());
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
      {copied ? "Copied!" : "Copy plan"}
    </Button>
  );
}
