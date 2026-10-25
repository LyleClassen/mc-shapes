/**
 * PROTOTYPE, throwaway. Variant A, "Paint studio": a vertical tool rail, a
 * context strip of tool options over the stage, and a right column with
 * Layers / Row guide tabs. Shapes are stamped with the Place-shape tool.
 * A Move click auto-selects the topmost layer under the cursor.
 */
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { RowGuide } from "../components/RowGuide";
import { ShapePicker } from "../components/ShapePicker";
import { StatsBar } from "../components/StatsBar";
import { SKINS } from "../render/skins";
import { countBlocks } from "../shapes/grid";
import { SHAPES } from "../shapes";
import { colors, fonts } from "../theme/tokens.stylex";
import { CanvasSize, LayerSettings, styles as s, usePlan } from "./LayerSettings";
import { Stage } from "./Stage";
import { describe, EraserOptions, LayerBadges, LayerThumb, TOOLS, UndoRedo } from "./tools";
import type { CompositeApi } from "./useComposite";

export const name = "Paint studio";

export function VariantA({ api }: { api: CompositeApi }) {
  const [tab, setTab] = useState<"layers" | "rows">("layers");
  const [row, setRow] = useState<number | null>(null);
  const plan = usePlan(api.composite);
  const top = [...api.composite.layers].reverse();

  return (
    <div {...stylex.props(styles.grid)}>
      <nav {...stylex.props(styles.rail)} aria-label="Tools">
        {TOOLS.map(t => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            onClick={() => api.setTool(t.id)}
            {...stylex.props(styles.tool, api.tool === t.id && styles.toolOn)}
          >
            <span {...stylex.props(styles.glyph)}>{t.glyph}</span>
            <span {...stylex.props(styles.toolLabel)}>{t.label}</span>
          </button>
        ))}
        <span {...stylex.props(styles.railGap)} />
        <UndoRedoStack api={api} />
      </nav>

      <section {...stylex.props(styles.center)}>
        <div {...stylex.props(styles.strip)}>
          {api.tool === "move" && <span {...stylex.props(s.muted)}>Click a layer on the canvas to select it, then drag. Click empty space to deselect.</span>}
          {api.tool === "shape" && (
            <div {...stylex.props(styles.picker)}>
              <ShapePicker
                shapes={SHAPES}
                selected={api.toolOpts.placeShapeId}
                onSelect={id => api.setToolOpts(o => ({ ...o, placeShapeId: id }))}
              />
            </div>
          )}
          {api.tool === "line" && <span {...stylex.props(s.muted)}>Press, drag, release. Shift snaps to 0°, 45° or 90°.</span>}
          {api.tool === "eraser" && <EraserOptions api={api} />}
          <span {...stylex.props(styles.push)} />
          <CanvasSize api={api} />
        </div>
        <StatsBar
          blocks={countBlocks(plan.grid)}
          solidBlocks={countBlocks(plan.grid)}
          width={plan.grid.width}
          height={plan.grid.height}
        />
        <Stage api={api} skin={SKINS[0]!} pick="auto" highlightRow={row === null ? null : row + plan.offset.y} />
      </section>

      <aside {...stylex.props(styles.side)}>
        <div {...stylex.props(styles.tabs)} role="tablist">
          <button type="button" role="tab" aria-selected={tab === "layers"} onClick={() => setTab("layers")} {...stylex.props(styles.tab, tab === "layers" && styles.tabOn)}>
            Layers · {api.composite.layers.length}
          </button>
          <button type="button" role="tab" aria-selected={tab === "rows"} onClick={() => setTab("rows")} {...stylex.props(styles.tab, tab === "rows" && styles.tabOn)}>
            Row guide
          </button>
        </div>

        {tab === "layers" ? (
          <>
            <ol {...stylex.props(styles.list)}>
              {top.map((l, i) => {
                const index = api.composite.layers.length - 1 - i;
                const on = l.id === api.selectedId;
                return (
                  <li key={l.id} onClick={() => api.setSelectedId(l.id)} {...stylex.props(styles.item, on && styles.itemOn)}>
                    <button
                      type="button"
                      title={l.visible ? "Hide" : "Show"}
                      onClick={e => {
                        e.stopPropagation();
                        api.updateLayer(l.id, x => ({ ...x, visible: !x.visible }));
                      }}
                      {...stylex.props(styles.eye)}
                    >
                      {l.visible ? "◉" : "○"}
                    </button>
                    <LayerThumb layer={l} size={30} />
                    <span {...stylex.props(styles.itemText)}>
                      <b {...stylex.props(styles.itemName)}>{l.name}</b>
                      <span {...stylex.props(styles.itemDesc)}>{describe(l)}</span>
                    </span>
                    <LayerBadges api={api} layer={l} />
                    <span {...stylex.props(styles.order)}>
                      <button type="button" title="Move up" disabled={i === 0} onClick={e => { e.stopPropagation(); api.reorder(l.id, index + 1); }} {...stylex.props(styles.mini)}>▲</button>
                      <button type="button" title="Move down" disabled={index === 0} onClick={e => { e.stopPropagation(); api.reorder(l.id, index - 1); }} {...stylex.props(styles.mini)}>▼</button>
                    </span>
                  </li>
                );
              })}
              {!top.length && <li {...stylex.props(s.muted)}>No layers yet. Pick Place shape or Line from the rail.</li>}
            </ol>
            <div {...stylex.props(styles.settings)}>
              <h3 {...stylex.props(styles.h)}>{api.selected ? "Layer settings" : "No layer selected"}</h3>
              {api.selected ? <LayerSettings api={api} layer={api.selected} /> : <p {...stylex.props(s.muted)}>Click a layer on the canvas or in the list.</p>}
            </div>
          </>
        ) : (
          <div {...stylex.props(styles.rows)}>
            <RowGuide grid={plan.grid} highlightRow={row} doneRows={new Set()} onHoverRow={setRow} onToggleRow={() => {}} />
          </div>
        )}
      </aside>
    </div>
  );
}

function UndoRedoStack({ api }: { api: CompositeApi }) {
  return (
    <div {...stylex.props(styles.undo)}>
      <UndoRedo api={api} />
    </div>
  );
}

const styles = stylex.create({
  grid: { display: "grid", gridTemplateColumns: "84px minmax(0, 1fr) 360px", gap: 16, alignItems: "start" },
  rail: {
    position: "sticky",
    top: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 6,
    borderRadius: 6,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: colors.line,
    backgroundColor: colors.panel,
    boxShadow: `5px 5px 0 ${colors.shadow}`,
  },
  tool: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    paddingBlock: 8,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: 4,
    backgroundColor: { default: "transparent", ":hover": colors.panelRaised },
    color: colors.inkSoft,
    cursor: "pointer",
  },
  toolOn: { borderColor: colors.gold, backgroundColor: colors.panelSunk, color: colors.gold },
  glyph: { fontSize: 22, lineHeight: 1 },
  toolLabel: { fontSize: 10, fontWeight: 800, fontFamily: fonts.body },
  railGap: { height: 12 },
  undo: { display: "flex", flexDirection: "column", gap: 4 },
  center: { display: "flex", flexDirection: "column", gap: 12, minWidth: 0 },
  strip: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    minHeight: 44,
    paddingBlock: 8,
    paddingInline: 12,
    borderRadius: 6,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
  },
  picker: { flexGrow: 1, minWidth: 0, maxWidth: 560 },
  push: { flexGrow: 1 },
  side: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: colors.line,
    backgroundColor: colors.panel,
    boxShadow: `5px 5px 0 ${colors.shadow}`,
    minWidth: 0,
  },
  tabs: { display: "flex", gap: 4 },
  tab: {
    flexGrow: 1,
    paddingBlock: 8,
    borderWidth: 0,
    borderBottomWidth: 3,
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    backgroundColor: "transparent",
    color: colors.inkFaint,
    fontFamily: fonts.pixel,
    fontSize: 9,
    cursor: "pointer",
  },
  tabOn: { borderBottomColor: colors.diamond, color: colors.ink },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 6,
    borderRadius: 4,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "transparent",
    backgroundColor: { default: colors.panelSunk, ":hover": colors.panelRaised },
    cursor: "pointer",
  },
  itemOn: { borderColor: colors.diamond },
  eye: { borderWidth: 0, backgroundColor: "transparent", color: colors.inkSoft, fontSize: 16, cursor: "pointer", padding: 0 },
  itemText: { display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 },
  itemName: { fontSize: 13, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  itemDesc: { fontSize: 11, color: colors.inkFaint },
  order: { display: "flex", flexDirection: "column" },
  mini: {
    borderWidth: 0,
    backgroundColor: "transparent",
    color: { default: colors.inkFaint, ":hover": colors.ink },
    fontSize: 9,
    cursor: "pointer",
    padding: 0,
    opacity: { default: 1, ":disabled": 0.25 },
  },
  settings: { display: "flex", flexDirection: "column", gap: 10, paddingTop: 10, borderTopWidth: 2, borderTopStyle: "solid", borderTopColor: colors.line },
  h: { margin: 0, fontFamily: fonts.pixel, fontSize: 10, color: colors.ink },
  rows: { maxHeight: "70vh", overflowY: "auto" },
});
