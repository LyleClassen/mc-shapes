import * as stylex from "@stylexjs/stylex";
import { useMemo } from "react";
import { EMPTY_COMPOSITE, newShapeLayer } from "../../composite/composite";
import type { CompositeApi, Tool, ToolOptions } from "../../composite/useComposite";
import { SHAPES } from "../../shapes";
import { fillParams } from "../../shapes/fill";
import { defaultValues } from "../../shapes/types";
import { colors, fonts } from "../../theme/tokens.stylex";
import { SHAPE_TYPE } from "./CompositeStage";
import { LayerThumb, Segmented, styles as ui } from "./controls";

const TOOLS: readonly { id: Tool; label: string; glyph: string }[] = [
  { id: "move", label: "Move", glyph: "✥" },
  { id: "line", label: "Line", glyph: "╱" },
  { id: "eraser", label: "Eraser", glyph: "⌫" },
];

/** The top bar: tools, then the shape palette (drag a shape onto the canvas), then undo and redo. */
export function CompositeToolbar({ api }: { api: CompositeApi }) {
  // A thumbnail per shape at its defaults; the palette never changes.
  const palette = useMemo(
    () =>
      SHAPES.map(shape => ({
        shape,
        layer: newShapeLayer(EMPTY_COMPOSITE, shape.id, { ...defaultValues(shape.params), ...defaultValues(fillParams) }),
      })),
    [],
  );

  return (
    <div {...stylex.props(styles.bar)}>
      <div role="radiogroup" aria-label="Tool" {...stylex.props(styles.group)}>
        {TOOLS.map(t => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={api.tool === t.id}
            title={t.label}
            onClick={() => api.setTool(t.id)}
            {...stylex.props(styles.tool, api.tool === t.id && styles.toolOn)}
          >
            <span aria-hidden {...stylex.props(styles.glyph)}>
              {t.glyph}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      <span {...stylex.props(styles.divider)} />

      <div {...stylex.props(styles.paletteGroup)}>
        <span {...stylex.props(styles.caption)}>Drag a shape onto the canvas ↓</span>
        <div {...stylex.props(styles.palette)}>
          {palette.map(({ shape, layer }) => (
            <span
              key={shape.id}
              draggable
              title={`Drag a ${shape.name.toLowerCase()} onto the canvas`}
              onDragStart={e => {
                e.dataTransfer.setData(SHAPE_TYPE, shape.id);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => api.say(`Drag the ${shape.name.toLowerCase()} onto the canvas to place it`)}
              {...stylex.props(styles.tile)}
            >
              <LayerThumb layer={layer} size={26} />
              {shape.name}
            </span>
          ))}
        </div>
      </div>

      <span {...stylex.props(ui.grow)} />

      <div {...stylex.props(styles.group)}>
        <button type="button" title="Undo (Ctrl+Z)" disabled={!api.canUndo} onClick={api.undo} {...stylex.props(ui.button)}>
          ↶ Undo
        </button>
        <button type="button" title="Redo (Ctrl+Shift+Z)" disabled={!api.canRedo} onClick={api.redo} {...stylex.props(ui.button)}>
          ↷ Redo
        </button>
      </div>
    </div>
  );
}

/** Brush or rectangle, brush size and Erase/Restore. Shown above the stage while the eraser is active. */
export function EraserOptions({ api }: { api: CompositeApi }) {
  const { options, selected } = api;
  const set = (patch: Partial<ToolOptions>) => api.setOptions(o => ({ ...o, ...patch }));
  const canRestore = selected?.kind === "eraser";

  return (
    <div {...stylex.props(ui.row, styles.options)}>
      <Segmented
        label="Eraser shape"
        value={options.eraserShape}
        options={[["brush", "Brush"], ["rect", "Rectangle"]]}
        onChange={eraserShape => set({ eraserShape })}
      />
      {options.eraserShape === "brush" && (
        <label {...stylex.props(ui.field)}>
          Size
          <input
            type="range"
            min={1}
            max={8}
            value={options.brushSize}
            onChange={e => set({ brushSize: Number(e.target.value) })}
            {...stylex.props(styles.slider)}
          />
          <b {...stylex.props(styles.mono)}>{options.brushSize}</b>
        </label>
      )}
      <Segmented
        label="Erase or restore"
        value={canRestore ? options.eraseMode : "erase"}
        options={[["erase", "Erase"], ["restore", "Restore"]]}
        disabled={canRestore ? [] : ["restore"]}
        title={canRestore ? undefined : "Select an eraser layer to restore its cells"}
        onChange={eraseMode => set({ eraseMode })}
      />
      <span {...stylex.props(ui.muted)}>
        {canRestore ? `Painting into "${selected.name}"` : "Each stroke makes a new eraser layer"}
      </span>
    </div>
  );
}

const styles = stylex.create({
  bar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    padding: 10,
    borderRadius: 6,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: colors.line,
    backgroundColor: colors.panel,
    boxShadow: `5px 5px 0 ${colors.shadow}`,
  },
  group: { display: "flex", gap: 4 },
  tool: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingInline: 10,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
    borderRadius: 4,
    backgroundColor: { default: colors.panelSunk, ":hover": colors.panelRaised },
    color: colors.inkSoft,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  toolOn: { borderColor: colors.gold, color: colors.gold, backgroundColor: colors.panelRaised },
  glyph: { fontSize: 17, lineHeight: 1 },
  divider: { width: 2, alignSelf: "stretch", backgroundColor: colors.line },
  paletteGroup: { display: "flex", flexDirection: "column", gap: 4 },
  caption: { fontSize: 11, fontWeight: 800, color: colors.grass },
  palette: { display: "flex", flexWrap: "wrap", gap: 4 },
  tile: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    paddingBlock: 4,
    paddingInline: 8,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: { default: colors.line, ":hover": colors.grass },
    borderRadius: 4,
    backgroundColor: { default: colors.panelSunk, ":hover": colors.panelRaised },
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: 800,
    cursor: "grab",
    userSelect: "none",
  },
  options: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  slider: { width: 110, accentColor: colors.redstone },
  mono: { fontFamily: fonts.mono, color: colors.diamond, minWidth: 12 },
});
