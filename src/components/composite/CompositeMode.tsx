import * as stylex from "@stylexjs/stylex";
import { useCallback, useMemo, useState } from "react";
import { flatten } from "../../composite/composite";
import { useComposite } from "../../composite/useComposite";
import { getSkin, SKINS } from "../../render/skins";
import { countBlocks, type Grid } from "../../shapes/grid";
import { highlight, highlightParam, type HighlightMode } from "../../shapes/patterns";
import type { Point } from "../../shapes/raster";
import { colors, fonts } from "../../theme/tokens.stylex";
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
  const [guideOpen, setGuideOpen] = useState(false);
  const [listRow, setListRow] = useState<number | null>(null);
  const [done, setDone] = useState<{ plan: Grid | null; rows: ReadonlySet<number> }>({ plan: null, rows: new Set() });

  const { grid, origin } = flat;
  const doneRows = done.plan === grid ? done.rows : EMPTY_SET;
  // Rows count from the trimmed plan's top; the stage draws in canvas rows.
  const hoverRow = hover && hover.y - origin.y >= 0 && hover.y - origin.y < grid.height ? hover.y - origin.y : null;
  const planRow = listRow ?? hoverRow;
  const canvasDone = useMemo(() => new Set([...doneRows].map(y => y + origin.y)), [doneRows, origin.y]);

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
    <div {...stylex.props(styles.page)}>
      <CompositeToolbar api={api} />

      <div {...stylex.props(styles.layout)}>
        <aside {...stylex.props(styles.column)}>
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

        <section {...stylex.props(styles.center)}>
          {api.tool === "eraser" && <EraserOptions api={api} />}
          <CompositeStage
            api={api}
            canvas={flat.canvas}
            skin={getSkin(view.skinId)}
            highlight={outline}
            highlightRow={planRow === null ? null : planRow + origin.y}
            doneRows={canvasDone}
            onHover={setHover}
          />
          <StatsBar blocks={blocks} solidBlocks={blocks} width={grid.width} height={grid.height} />
          <details onToggle={e => setGuideOpen(e.currentTarget.open)} {...stylex.props(styles.details)}>
            <summary {...stylex.props(styles.summary)}>
              Row guide
              <span {...stylex.props(styles.count)}>
                {grid.height ? `${grid.height} rows` : "no blocks yet"}
                {doneRows.size > 0 && ` · ${doneRows.size}/${grid.height} done`}
              </span>
            </summary>
            {/* Only rendered while open: every row re-renders on each drag move. */}
            {guideOpen && (
              <div {...stylex.props(styles.guide)}>
                <p {...stylex.props(styles.legend)}>
                  <span {...stylex.props(styles.legendGap)}>·4</span> skip 4 ·{" "}
                  <span {...stylex.props(styles.legendFill)}>3</span> place 3 · rows count from the top of the
                  trimmed plan · click a row to tick it off
                </p>
                <RowGuide
                  grid={grid}
                  highlightRow={planRow}
                  doneRows={doneRows}
                  onHoverRow={setListRow}
                  onToggleRow={toggleRow}
                />
              </div>
            )}
          </details>
        </section>

        <Panel title="Layers" accent="diamond" xstyle={styles.layers}>
          <LayersPanel api={api} />
        </Panel>
      </div>
    </div>
  );
}

const EMPTY_SET: ReadonlySet<number> = new Set();

const NARROW = "@media (max-width: 1180px)";
const PHONE = "@media (max-width: 760px)";

const styles = stylex.create({
  page: { display: "flex", flexDirection: "column", gap: 16 },
  layout: {
    display: "grid",
    gridTemplateColumns: {
      default: "330px minmax(0, 1fr) 300px",
      [NARROW]: "300px minmax(0, 1fr)",
      [PHONE]: "minmax(0, 1fr)",
    },
    alignItems: "start",
    gap: 20,
  },
  column: { display: "flex", flexDirection: "column", gap: 20, minWidth: 0 },
  center: { display: "flex", flexDirection: "column", gap: 14, minWidth: 0 },
  layers: { gridColumn: { default: "auto", [NARROW]: "1 / -1" } },
  details: {
    paddingBlock: 12,
    paddingInline: 16,
    borderRadius: 6,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: colors.line,
    backgroundColor: colors.panel,
    boxShadow: `5px 5px 0 ${colors.shadow}`,
  },
  summary: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontFamily: fonts.pixel,
    fontSize: 11,
    lineHeight: 1.4,
    textTransform: "uppercase",
    color: colors.ink,
    cursor: "pointer",
  },
  count: { fontFamily: fonts.body, fontSize: 12, fontWeight: 700, textTransform: "none", color: colors.inkFaint },
  guide: { display: "flex", flexDirection: "column", gap: 10, marginTop: 12 },
  legend: { margin: 0, fontSize: 12, color: colors.inkFaint },
  legendGap: { fontFamily: fonts.mono, fontWeight: 700 },
  legendFill: {
    fontFamily: fonts.mono,
    fontWeight: 700,
    paddingInline: 4,
    borderRadius: 2,
    backgroundColor: colors.grass,
    color: colors.skyDeep,
  },
});
