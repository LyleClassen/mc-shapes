import * as stylex from "@stylexjs/stylex";
import type { Skin } from "../render/skins";
import { colors } from "../theme/tokens.stylex";

interface Props {
  skins: readonly Skin[];
  selected: string;
  onSelect: (id: string) => void;
}

export function SkinPicker({ skins, selected, onSelect }: Props) {
  return (
    <div {...stylex.props(styles.row)} role="radiogroup" aria-label="Block">
      {skins.map(skin => (
        <button
          key={skin.id}
          type="button"
          role="radio"
          aria-checked={skin.id === selected}
          aria-label={skin.name}
          title={skin.name}
          onClick={() => onSelect(skin.id)}
          {...stylex.props(styles.swatch, styles.paint(skin.face, skin.light, skin.dark), skin.id === selected && styles.on)}
        />
      ))}
    </div>
  );
}

const styles = stylex.create({
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  swatch: {
    width: 34,
    height: 34,
    padding: 0,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: colors.shadow,
    borderRadius: 2,
    cursor: "pointer",
    transform: { default: null, ":hover": "translateY(-2px) rotate(-4deg)" },
    transitionProperty: "transform",
    transitionDuration: "120ms",
  },
  paint: (face: string, light: string, dark: string) => ({
    backgroundColor: face,
    boxShadow: `inset 4px 4px 0 ${light}, inset -4px -4px 0 ${dark}`,
  }),
  on: {
    borderColor: colors.gold,
    transform: { default: "translateY(-3px)", ":hover": "translateY(-3px)" },
    outlineWidth: 2,
    outlineStyle: "solid",
    outlineColor: colors.shadow,
  },
});
