import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef } from "react";
import { trim } from "../shapes/grid";
import { defaultValues, type ShapeModule } from "../shapes/types";
import { colors, fonts } from "../theme/tokens.stylex";

interface Props {
  shapes: readonly ShapeModule[];
  selected: string;
  onSelect: (id: string) => void;
}

export function ShapePicker({ shapes, selected, onSelect }: Props) {
  return (
    <div {...stylex.props(styles.grid)}>
      {shapes.map(shape => {
        const active = shape.id === selected;
        return (
          <button
            key={shape.id}
            type="button"
            title={shape.description}
            aria-pressed={active}
            onClick={() => onSelect(shape.id)}
            {...stylex.props(styles.card, active && styles.cardActive)}
          >
            <ShapeThumb shape={shape} active={active} />
            <span {...stylex.props(styles.name)}>{shape.name}</span>
          </button>
        );
      })}
    </div>
  );
}

const THUMB = 44;

/** A tiny preview rendered from the shape module's own defaults. */
function ShapeThumb({ shape, active }: { shape: ShapeModule; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = THUMB * dpr;
    canvas.height = THUMB * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, THUMB, THUMB);

    const grid = trim(shape.build(defaultValues(shape.params)));
    const cell = THUMB / Math.max(grid.width, grid.height, 1);
    const ox = (THUMB - grid.width * cell) / 2;
    const oy = (THUMB - grid.height * cell) / 2;
    ctx.fillStyle = active ? "#ffd23f" : "#72e36c";
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.cells[y * grid.width + x]) ctx.fillRect(ox + x * cell, oy + y * cell, cell + 0.3, cell + 0.3);
      }
    }
  }, [shape, active]);

  return <canvas ref={ref} aria-hidden {...stylex.props(styles.thumb)} />;
}

const styles = stylex.create({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
    gap: 8,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    paddingBlock: 10,
    paddingInline: 6,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: { default: colors.line, ":hover": colors.inkFaint },
    borderRadius: 4,
    backgroundColor: { default: colors.panelSunk, ":hover": colors.panelRaised },
    color: colors.inkSoft,
    cursor: "pointer",
    boxShadow: `3px 3px 0 ${colors.shadow}`,
    transform: { default: null, ":hover": "translateY(-2px)", ":active": "translateY(1px)" },
    transitionProperty: "transform, background-color, border-color",
    transitionDuration: "120ms",
  },
  cardActive: {
    borderColor: { default: colors.gold, ":hover": colors.gold },
    backgroundColor: { default: colors.panelRaised, ":hover": colors.panelRaised },
    color: colors.ink,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    imageRendering: "pixelated",
  },
  name: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.2,
    textAlign: "center",
  },
});
