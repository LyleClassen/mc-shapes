import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { isOffCanvas } from "../../composite/composite";
import { describeLayer } from "../../composite/edit";
import type { CompositeApi } from "../../composite/useComposite";
import { colors } from "../../theme/tokens.stylex";
import { LayerThumb, styles as ui } from "./controls";

const LAYER_TYPE = "application/x-composite-layer";

/** Photoshop-style layer list: top layer first, an eye per row, click to select, drag rows to reorder. */
export function LayersPanel({ api }: { api: CompositeApi }) {
  const { layers, canvas } = api.composite;
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  if (!layers.length) return <p {...stylex.props(ui.muted)}>No layers yet. Drag a shape onto the canvas.</p>;

  return (
    <>
      <ol {...stylex.props(styles.list)}>
        {layers
          .map((layer, index) => ({ layer, index }))
          .reverse()
          .map(({ layer, index }) => (
            <li
              key={layer.id}
              draggable
              onDragStart={e => {
                e.dataTransfer.setData(LAYER_TYPE, layer.id);
                e.dataTransfer.effectAllowed = "move";
                setDragId(layer.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDragOver={e => {
                if (!dragId) return;
                e.preventDefault();
                setOverId(layer.id);
              }}
              onDrop={e => {
                e.preventDefault();
                if (dragId && dragId !== layer.id) api.reorder(dragId, index);
                setDragId(null);
                setOverId(null);
              }}
              onClick={() => api.select(layer.id === api.selectedId ? null : layer.id)}
              {...stylex.props(
                styles.item,
                layer.id === api.selectedId && styles.selected,
                dragId === layer.id && styles.dragging,
                overId === layer.id && dragId !== layer.id && styles.over,
              )}
            >
              <button
                type="button"
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                aria-pressed={layer.visible}
                onClick={e => {
                  e.stopPropagation();
                  api.updateLayer(layer.id, l => ({ ...l, visible: !l.visible }));
                }}
                {...stylex.props(styles.eye, !layer.visible && styles.eyeOff)}
              >
                {layer.visible ? "◉" : "○"}
              </button>
              <LayerThumb layer={layer} />
              <span {...stylex.props(styles.text)}>
                <b {...stylex.props(styles.name)}>{layer.name}</b>
                <span {...stylex.props(styles.desc)}>{describeLayer(layer)}</span>
              </span>
              <span {...stylex.props(styles.badges)}>
                {!layer.visible && <span {...stylex.props(ui.badge)}>hidden</span>}
                {isOffCanvas(layer, canvas) && (layer.kind !== "eraser" || layer.cells.length > 0) && (
                  <span {...stylex.props(ui.badge, ui.warn)}>off canvas</span>
                )}
                {layer.kind === "eraser" && !layer.cells.length && <span {...stylex.props(ui.badge)}>empty</span>}
              </span>
            </li>
          ))}
      </ol>
      <p {...stylex.props(ui.muted)}>Top layer first. Each layer sees only the layers below it. Drag rows to reorder.</p>
    </>
  );
}

const styles = stylex.create({
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 3 },
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
    userSelect: "none",
  },
  selected: { borderColor: colors.diamond, backgroundColor: colors.panelRaised },
  dragging: { opacity: 0.4 },
  over: { borderTopColor: colors.gold },
  eye: {
    width: 22,
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    color: { default: colors.inkSoft, ":hover": colors.ink },
    fontSize: 16,
    cursor: "pointer",
  },
  eyeOff: { color: colors.inkFaint },
  text: { display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 },
  name: { fontSize: 13, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  desc: { fontSize: 11, color: colors.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  badges: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 },
});
