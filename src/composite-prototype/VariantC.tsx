/**
 * PROTOTYPE, throwaway. Variant C, "Canvas first": the stage takes the full
 * width. Tools and a shape palette sit in one bar above it. Shapes are dragged
 * from the palette and dropped where they should go (or click a tile, then
 * click the canvas). The selected layer's settings float over the stage's
 * right edge. Layers run as a horizontal strip under the stage, bottom on the
 * left, dragged sideways to reorder. A click picks the top layer; Alt-click
 * steps down through the layers under the cursor.
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
import { EraserOptions, LayerBadges, LayerThumb, TOOLS, UndoRedo } from "./tools";
import type { CompositeApi } from "./useComposite";

export const name = "Canvas first";

export function VariantC({ api }: { api: CompositeApi }) {
  const [row, setRow] = useState<number | null>(null);
  const [inspector, setInspector] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const plan = usePlan(api.composite);
  const palette = useMemo(() => SHAPES.map(sh => ({ shape: sh, layer: makeShapeLayer(EMPTY_COMPOSITE, sh.id) })), []);
  const layers = api.composite.layers;

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
              onClick={() => {
                api.setTool("shape");
                api.setToolOpts(o => ({ ...o, placeShapeId: shape.id }));
              }}
              {...stylex.props(styles.tile, api.tool === "shape" && api.toolOpts.placeShapeId === shape.id && styles.toolOn)}
            >
              <LayerThumb layer={layer} size={28} />
              <span>{shape.name}</span>
            </button>
          ))}
        </div>
        <span {...stylex.props(styles.push)} />
        <UndoRedo api={api} />
        <CanvasSize api={api} />
      </div>
      {api.tool === "eraser" && <EraserOptions api={api} />}

      <div {...stylex.props(styles.stageWrap)}>
        <Stage api={api} skin={SKINS[0]!} pick="cycle" acceptDrop height="min(76vh, 860px)" highlightRow={row === null ? null : row + plan.offset.y} />
        {api.selected && (
          <div {...stylex.props(styles.inspector, !inspector && styles.inspectorShut)}>
            <button type="button" onClick={() => setInspector(o => !o)} {...stylex.props(styles.inspectorHead)}>
              <span>{api.selected.name}</span>
              <span>{inspector ? "▸ hide" : "◂"}</span>
            </button>
            {inspector && (
              <div {...stylex.props(styles.inspectorBody)}>
                <LayerSettings api={api} layer={api.selected} compact />
              </div>
            )}
          </div>
        )}
      </div>

      <div {...stylex.props(styles.stripWrap)}>
        <span {...stylex.props(styles.stripLabel)}>Bottom</span>
        <ol {...stylex.props(styles.strip)}>
          {layers.map((l, i) => (
            <li
              key={l.id}
              draggable
              onDragStart={e => { setDragId(l.id); e.dataTransfer.setData("text/layer", l.id); }}
              onDragEnd={() => setDragId(null)}
              onDragOver={e => dragId && e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (dragId && dragId !== l.id) api.reorder(dragId, i); setDragId(null); }}
              onClick={() => api.setSelectedId(l.id)}
              {...stylex.props(styles.card, l.id === api.selectedId && styles.cardOn, dragId === l.id && styles.cardDrag)}
            >
              <LayerThumb layer={l} size={48} />
              <span {...stylex.props(styles.cardName)}>{l.name}</span>
              <span {...stylex.props(styles.cardBadges)}>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); api.updateLayer(l.id, x => ({ ...x, visible: !x.visible })); }}
                  {...stylex.props(styles.eye)}
                >
                  {l.visible ? "◉" : "○"}
                </button>
                <LayerBadges api={api} layer={l} />
              </span>
            </li>
          ))}
          {!layers.length && <li {...stylex.props(s.muted)}>Drag a shape from the palette onto the canvas.</li>}
        </ol>
        <span {...stylex.props(styles.stripLabel)}>Top</span>
      </div>

      <StatsBar blocks={countBlocks(plan.grid)} solidBlocks={countBlocks(plan.grid)} width={plan.grid.width} height={plan.grid.height} />
      <details {...stylex.props(styles.details)}>
        <summary {...stylex.props(styles.summary)}>Row guide ({plan.grid.height} rows)</summary>
        <RowGuide grid={plan.grid} highlightRow={row} doneRows={new Set()} onHoverRow={setRow} onToggleRow={() => {}} />
      </details>
    </div>
  );
}

const styles = stylex.create({
  page: { display: "flex", flexDirection: "column", gap: 12 },
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
  stageWrap: { position: "relative" },
  inspector: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 320,
    maxHeight: "calc(100% - 60px)",
    overflowY: "auto",
    borderRadius: 6,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.diamond,
    backgroundColor: "rgba(37, 30, 90, 0.96)",
    boxShadow: `5px 5px 0 ${colors.shadow}`,
  },
  inspectorShut: { width: "auto" },
  inspectorHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    paddingBlock: 8,
    paddingInline: 10,
    borderWidth: 0,
    backgroundColor: "transparent",
    color: colors.ink,
    fontFamily: fonts.pixel,
    fontSize: 9,
    cursor: "pointer",
  },
  inspectorBody: { paddingInline: 12, paddingBottom: 12 },
  stripWrap: { display: "flex", alignItems: "center", gap: 8 },
  stripLabel: { fontFamily: fonts.pixel, fontSize: 8, color: colors.inkFaint },
  strip: { listStyle: "none", margin: 0, padding: 4, display: "flex", gap: 8, overflowX: "auto", flexGrow: 1 },
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    width: 96,
    flexShrink: 0,
    padding: 6,
    borderRadius: 4,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
    backgroundColor: colors.panelSunk,
    cursor: "pointer",
  },
  cardOn: { borderColor: colors.diamond, backgroundColor: colors.panelRaised },
  cardDrag: { opacity: 0.4 },
  cardName: { maxWidth: "100%", fontSize: 11, fontWeight: 800, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cardBadges: { display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 3 },
  eye: { padding: 0, borderWidth: 0, backgroundColor: "transparent", color: colors.inkSoft, cursor: "pointer" },
  details: { padding: 12, borderRadius: 6, backgroundColor: colors.panel, borderWidth: 2, borderStyle: "solid", borderColor: colors.line },
  summary: { fontFamily: fonts.pixel, fontSize: 10, color: colors.ink, cursor: "pointer" },
});
