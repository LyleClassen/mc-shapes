/**
 * PROTOTYPE, throwaway. Variant B, "Shapes-mode twin": the same three columns
 * as single-shape mode. The left sidebar holds a Layers panel whose selected
 * row unfolds into its settings (accordion). Shapes are added from an "Add"
 * menu, land centred on the canvas, then get dragged into place. Selection
 * comes from the list; on the canvas Move drags the selected layer from
 * anywhere, and only Ctrl/⌘-click picks a layer.
 */
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { Panel } from "../components/Panel";
import { RowGuide } from "../components/RowGuide";
import { SkinPicker } from "../components/SkinPicker";
import { StatsBar } from "../components/StatsBar";
import { getSkin, SKINS } from "../render/skins";
import { countBlocks } from "../shapes/grid";
import { SHAPES } from "../shapes";
import { colors, fonts } from "../theme/tokens.stylex";
import { makeShapeLayer } from "./engine";
import { CanvasSize, LayerSettings, styles as s, usePlan } from "./LayerSettings";
import { Stage } from "./Stage";
import { describe, EraserOptions, LayerBadges, LayerThumb, Seg, UndoRedo } from "./tools";
import type { CompositeApi, Tool } from "./useComposite";

export const name = "Shapes-mode twin";

export function VariantB({ api }: { api: CompositeApi }) {
  const [adding, setAdding] = useState(false);
  const [row, setRow] = useState<number | null>(null);
  const [skinId, setSkinId] = useState(SKINS[0]!.id);
  const plan = usePlan(api.composite);
  const top = [...api.composite.layers].reverse();
  // "shape" isn't a canvas tool here: shapes come from the Add menu.
  const tool: Tool = api.tool === "shape" ? "move" : api.tool;

  return (
    <div {...stylex.props(styles.layout)}>
      <aside {...stylex.props(styles.sidebar)}>
        <Panel
          title="Layers"
          accent="grass"
          action={
            <button type="button" onClick={() => setAdding(a => !a)} {...stylex.props(s.btn, adding && s.on)}>
              + Add
            </button>
          }
        >
          {adding && (
            <div {...stylex.props(styles.menu)}>
              <span {...stylex.props(styles.menuHead)}>Shape (lands in the middle)</span>
              {SHAPES.map(sh => (
                <button
                  key={sh.id}
                  type="button"
                  onClick={() => {
                    api.addLayer(makeShapeLayer(api.composite, sh.id));
                    api.setTool("move");
                    setAdding(false);
                  }}
                  {...stylex.props(styles.menuItem)}
                >
                  {sh.name}
                </button>
              ))}
              <span {...stylex.props(styles.menuHead)}>Draw</span>
              <button type="button" onClick={() => { api.setTool("line"); setAdding(false); }} {...stylex.props(styles.menuItem)}>
                Line… (then drag on the canvas)
              </button>
              <button
                type="button"
                onClick={() => { api.setSelectedId(null); api.setTool("eraser"); setAdding(false); }}
                {...stylex.props(styles.menuItem)}
              >
                Eraser… (then paint on the canvas)
              </button>
            </div>
          )}

          <ol {...stylex.props(styles.list)}>
            {top.map((l, i) => {
              const index = api.composite.layers.length - 1 - i;
              const open = l.id === api.selectedId;
              return (
                <li key={l.id} {...stylex.props(styles.item, open && styles.itemOpen)}>
                  <div {...stylex.props(styles.head)} onClick={() => api.setSelectedId(open ? null : l.id)}>
                    <span {...stylex.props(styles.caret)}>{open ? "▾" : "▸"}</span>
                    <LayerThumb layer={l} size={28} />
                    <span {...stylex.props(styles.text)}>
                      <b {...stylex.props(styles.name)}>{l.name}</b>
                      <span {...stylex.props(styles.desc)}>{describe(l)}</span>
                    </span>
                    <LayerBadges api={api} layer={l} />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); api.updateLayer(l.id, x => ({ ...x, visible: !x.visible })); }}
                      {...stylex.props(styles.icon)}
                      title={l.visible ? "Hide" : "Show"}
                    >
                      {l.visible ? "👁" : "—"}
                    </button>
                    <button type="button" disabled={i === 0} onClick={e => { e.stopPropagation(); api.reorder(l.id, index + 1); }} {...stylex.props(styles.icon)} title="Move up">↑</button>
                    <button type="button" disabled={index === 0} onClick={e => { e.stopPropagation(); api.reorder(l.id, index - 1); }} {...stylex.props(styles.icon)} title="Move down">↓</button>
                  </div>
                  {open && (
                    <div {...stylex.props(styles.body)}>
                      <LayerSettings api={api} layer={l} />
                    </div>
                  )}
                </li>
              );
            })}
            {!top.length && <li {...stylex.props(s.muted)}>Empty. Use + Add.</li>}
          </ol>
        </Panel>

        <Panel title="Canvas & block" accent="amethyst">
          <CanvasSize api={api} />
          <SkinPicker skins={SKINS} selected={skinId} onSelect={setSkinId} />
        </Panel>
      </aside>

      <section {...stylex.props(styles.center)}>
        <StatsBar blocks={countBlocks(plan.grid)} solidBlocks={countBlocks(plan.grid)} width={plan.grid.width} height={plan.grid.height} />
        <div {...stylex.props(s.row)}>
          <Seg<Tool>
            value={tool}
            options={[["move", "✥ Move"], ["line", "╱ Line"], ["eraser", "⌫ Eraser"]]}
            onChange={api.setTool}
          />
          <UndoRedo api={api} />
        </div>
        {tool === "eraser" && <EraserOptions api={api} />}
        <Stage api={{ ...api, tool }} skin={getSkin(skinId)} pick="modifier" highlightRow={row === null ? null : row + plan.offset.y} />
      </section>

      <Panel title="Row guide" accent="diamond">
        <RowGuide grid={plan.grid} highlightRow={row} doneRows={new Set()} onHoverRow={setRow} onToggleRow={() => {}} />
      </Panel>
    </div>
  );
}

const styles = stylex.create({
  layout: { display: "grid", gridTemplateColumns: "360px minmax(0, 1fr) 300px", alignItems: "start", gap: 20 },
  sidebar: { display: "flex", flexDirection: "column", gap: 20, minWidth: 0 },
  center: { display: "flex", flexDirection: "column", gap: 12, minWidth: 0 },
  menu: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: 8,
    borderRadius: 4,
    backgroundColor: colors.panelSunk,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.diamond,
  },
  menuHead: { marginTop: 4, fontFamily: fonts.pixel, fontSize: 8, color: colors.inkFaint },
  menuItem: {
    textAlign: "left",
    paddingBlock: 5,
    paddingInline: 8,
    borderWidth: 0,
    borderRadius: 3,
    backgroundColor: { default: "transparent", ":hover": colors.panelRaised },
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 },
  item: { borderRadius: 4, borderWidth: 2, borderStyle: "solid", borderColor: colors.line, backgroundColor: colors.panelSunk },
  itemOpen: { borderColor: colors.gold },
  head: { display: "flex", alignItems: "center", gap: 6, padding: 6, cursor: "pointer" },
  caret: { width: 12, color: colors.inkFaint },
  text: { display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 },
  name: { fontSize: 13, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  desc: { fontSize: 11, color: colors.inkFaint },
  icon: {
    width: 22,
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    color: { default: colors.inkFaint, ":hover": colors.ink },
    fontSize: 13,
    cursor: "pointer",
    opacity: { default: 1, ":disabled": 0.25 },
  },
  body: { padding: 10, borderTopWidth: 2, borderTopStyle: "dashed", borderTopColor: colors.line },
});
