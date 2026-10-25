/**
 * PROTOTYPE, throwaway. Variant D, "Picked": the combination chosen after
 * reviewing A–C. Tools and the shape palette in a bar on top (from C; shapes
 * are dragged onto the canvas). Selected layer's settings in a left column,
 * dimensions first. A Photoshop-style Layers column on the right: top layer
 * first, eye, thumbnail, drag to reorder. On the canvas, Move drags the
 * selected layer and Ctrl/⌘-click picks one (Photoshop with Auto-Select off).
 * Stats and a collapsible row guide sit below the stage.
 */
import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";
import { RowGuide } from "../components/RowGuide";
import { StatsBar } from "../components/StatsBar";
import { SKINS } from "../render/skins";
import { countBlocks } from "../shapes/grid";
import { SHAPES } from "../shapes";
import { colors, fonts } from "../theme/tokens.stylex";
import { EMPTY_COMPOSITE, makeShapeLayer } from "./engine";
import { CanvasSize, LayerSettings, styles as s, usePlan } from "./LayerSettings";
import { Stage } from "./Stage";
import { describe, EraserOptions, LayerBadges, LayerThumb, TOOLS, UndoRedo } from "./tools";
import type { CompositeApi } from "./useComposite";

export const name = "Picked";

export function VariantD({ api }: { api: CompositeApi }) {
  const [row, setRow] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const plan = usePlan(api.composite);
  const palette = useMemo(() => SHAPES.map(sh => ({ shape: sh, layer: makeShapeLayer(EMPTY_COMPOSITE, sh.id) })), []);
  const { layers } = api.composite;
  const top = [...layers].reverse();

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.bar)}>
        <div {...stylex.props(styles.tools)}>
          {TOOLS.filter(t => t.id !== "shape").map(t => (
            <button key={t.id} type="button" title={t.label} onClick={() => api.setTool(t.id)} {...stylex.props(styles.tool, api.tool === t.id && styles.toolOn)}>
              {t.glyph}
            </button>
          ))}
        </div>
        <div {...stylex.props(styles.palette)} title="Drag a shape onto the canvas">
          {palette.map(({ shape, layer }) => (
            <button
              key={shape.id}
              type="button"
              draggable
              onDragStart={e => e.dataTransfer.setData("text/shape", shape.id)}
              {...stylex.props(styles.tile)}
            >
              <LayerThumb layer={layer} size={28} />
              <span>{shape.name}</span>
            </button>
          ))}
        </div>
        <span {...stylex.props(styles.push)} />
        <UndoRedo api={api} />
      </div>

      <div {...stylex.props(styles.grid)}>
        <aside {...stylex.props(styles.panel)}>
          <h3 {...stylex.props(styles.h)}>{api.selected ? api.selected.name : "Composite"}</h3>
          {api.selected ? (
            <LayerSettings api={api} layer={api.selected} />
          ) : (
            <>
              <CanvasSize api={api} />
              <p {...stylex.props(s.muted)}>Select a layer in the Layers column (or Ctrl-click it on the canvas) to edit it.</p>
            </>
          )}
        </aside>

        <section {...stylex.props(styles.center)}>
          {api.tool === "eraser" && <EraserOptions api={api} />}
          <Stage api={api} skin={SKINS[0]!} pick="modifier" acceptDrop highlightRow={row === null ? null : row + plan.offset.y} />
          <StatsBar blocks={countBlocks(plan.grid)} solidBlocks={countBlocks(plan.grid)} width={plan.grid.width} height={plan.grid.height} />
          <details {...stylex.props(styles.details)}>
            <summary {...stylex.props(styles.summary)}>Row guide ({plan.grid.height} rows)</summary>
            <RowGuide grid={plan.grid} highlightRow={row} doneRows={new Set()} onHoverRow={setRow} onToggleRow={() => {}} />
          </details>
        </section>

        <aside {...stylex.props(styles.panel)}>
          <h3 {...stylex.props(styles.h)}>Layers</h3>
          <ol {...stylex.props(styles.list)}>
            {top.map(l => {
              const index = layers.indexOf(l);
              return (
                <li
                  key={l.id}
                  draggable
                  onDragStart={e => { setDragId(l.id); e.dataTransfer.setData("text/layer", l.id); }}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={e => dragId && e.preventDefault()}
                  onDrop={e => { e.preventDefault(); if (dragId && dragId !== l.id) api.reorder(dragId, index); setDragId(null); }}
                  onClick={() => api.setSelectedId(l.id)}
                  {...stylex.props(styles.item, l.id === api.selectedId && styles.itemOn, dragId === l.id && styles.dragging)}
                >
                  <button
                    type="button"
                    title={l.visible ? "Hide" : "Show"}
                    onClick={e => { e.stopPropagation(); api.updateLayer(l.id, x => ({ ...x, visible: !x.visible })); }}
                    {...stylex.props(styles.eye)}
                  >
                    {l.visible ? "◉" : "○"}
                  </button>
                  <LayerThumb layer={l} size={32} />
                  <span {...stylex.props(styles.text)}>
                    <b {...stylex.props(styles.name)}>{l.name}</b>
                    <span {...stylex.props(styles.desc)}>{describe(l)}</span>
                  </span>
                  <LayerBadges api={api} layer={l} />
                </li>
              );
            })}
            {!top.length && <li {...stylex.props(s.muted)}>Drag a shape from the palette onto the canvas.</li>}
          </ol>
          <p {...stylex.props(s.muted)}>Top layer first. Drag rows to reorder.</p>
        </aside>
      </div>
    </div>
  );
}

const styles = stylex.create({
  page: { display: "flex", flexDirection: "column", gap: 14 },
  bar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    padding: 8,
    borderRadius: 6,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: colors.line,
    backgroundColor: colors.panel,
    boxShadow: `5px 5px 0 ${colors.shadow}`,
  },
  tools: { display: "flex", gap: 4 },
  tool: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
    borderRadius: 4,
    backgroundColor: { default: colors.panelSunk, ":hover": colors.panelRaised },
    color: colors.inkSoft,
    fontSize: 18,
    cursor: "pointer",
  },
  toolOn: { borderColor: colors.gold, color: colors.gold },
  palette: { display: "flex", gap: 4, flexWrap: "wrap" },
  tile: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    paddingBlock: 4,
    paddingInline: 6,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
    borderRadius: 4,
    backgroundColor: { default: colors.panelSunk, ":hover": colors.panelRaised },
    color: colors.inkSoft,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: 800,
    cursor: "grab",
  },
  push: { flexGrow: 1 },
  grid: { display: "grid", gridTemplateColumns: "340px minmax(0, 1fr) 300px", gap: 16, alignItems: "start" },
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 14,
    borderRadius: 6,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: colors.line,
    backgroundColor: colors.panel,
    boxShadow: `5px 5px 0 ${colors.shadow}`,
    minWidth: 0,
  },
  h: { margin: 0, fontFamily: fonts.pixel, fontSize: 10, color: colors.ink },
  center: { display: "flex", flexDirection: "column", gap: 12, minWidth: 0 },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 6,
    borderRadius: 3,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "transparent",
    backgroundColor: { default: colors.panelSunk, ":hover": colors.panelRaised },
    cursor: "grab",
  },
  itemOn: { borderColor: colors.diamond, backgroundColor: colors.panelRaised },
  dragging: { opacity: 0.4 },
  eye: { padding: 0, borderWidth: 0, backgroundColor: "transparent", color: colors.inkSoft, fontSize: 16, cursor: "pointer" },
  text: { display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 },
  name: { fontSize: 13, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  desc: { fontSize: 11, color: colors.inkFaint },
  details: { padding: 12, borderRadius: 6, backgroundColor: colors.panel, borderWidth: 2, borderStyle: "solid", borderColor: colors.line },
  summary: { fontFamily: fonts.pixel, fontSize: 10, color: colors.ink, cursor: "pointer" },
});
