import * as stylex from "@stylexjs/stylex";
import type { Highlight, HighlightMode } from "../shapes/patterns";
import { colors, fonts } from "../theme/tokens.stylex";

/** Custom colours are applied on top, so picking one doesn't re-trace the outline. */
export function recolour(traced: Highlight | null, custom: Record<string, string>): Highlight | null {
  return traced && { ...traced, legend: traced.legend.map(l => ({ ...l, color: custom[l.id] ?? l.color })) };
}

/**
 * One chip per colour on the outline: a step length, or step length × group
 * size. Click a chip to recolour it; `custom` holds every mode's picks.
 */
export function PatternLegend({
  highlight,
  mode,
  custom,
  onChange,
}: {
  highlight: Highlight | null;
  mode: HighlightMode;
  custom: Record<string, string>;
  onChange: (custom: Record<string, string>) => void;
}) {
  if (!highlight?.legend.length) return null;
  const { legend } = highlight;
  return (
    <div {...stylex.props(styles.legend)}>
      {legend.map(({ id, label, color }) => (
        <label key={id} title={`Pick a colour for ${label}`} {...stylex.props(styles.chip)} style={{ backgroundColor: color, color: textOn(color) }}>
          {label}
          <input
            type="color"
            value={color}
            onChange={e => onChange({ ...custom, [id]: e.target.value })}
            {...stylex.props(styles.colorInput)}
          />
        </label>
      ))}
      {legend.some(l => l.id in custom) && (
        <button
          type="button"
          onClick={() => onChange(Object.fromEntries(Object.entries(custom).filter(([id]) => !id.startsWith(`${mode}:`))))}
          {...stylex.props(styles.reset)}
        >
          Reset colours
        </button>
      )}
    </div>
  );
}

/** Dark text on light chips, white on dark ones. */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.45 ? "#0c0924" : "#ffffff";
}

const styles = stylex.create({
  legend: {
    margin: 0,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: colors.inkFaint,
  },
  chip: {
    position: "relative",
    paddingBlock: 2,
    paddingInline: 7,
    borderRadius: 3,
    boxShadow: { default: `inset 0 -2px 0 rgba(0,0,0,0.3)`, ":hover": `0 0 0 2px ${colors.ink}` },
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  colorInput: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
  },
  reset: {
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    color: { default: colors.inkFaint, ":hover": colors.ink },
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: 700,
    textDecoration: "underline",
    cursor: "pointer",
  },
});
