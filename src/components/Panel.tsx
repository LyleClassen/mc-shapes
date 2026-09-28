import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { colors, fonts } from "../theme/tokens.stylex";

interface Props {
  title: string;
  accent?: "grass" | "gold" | "diamond" | "amethyst" | "redstone";
  action?: ReactNode;
  children: ReactNode;
  xstyle?: stylex.StyleXStyles;
}

export function Panel({ title, accent = "grass", action, children, xstyle }: Props) {
  return (
    <section {...stylex.props(styles.panel, xstyle)}>
      <header {...stylex.props(styles.header)}>
        <span {...stylex.props(styles.pip, accents[accent])} />
        <h2 {...stylex.props(styles.title)}>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

const styles = stylex.create({
  panel: {
    backgroundColor: colors.panel,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: colors.line,
    borderRadius: 6,
    boxShadow: `5px 5px 0 ${colors.shadow}`,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    minWidth: 0,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  pip: {
    width: 12,
    height: 12,
    flexShrink: 0,
    boxShadow: `inset -3px -3px 0 rgba(0,0,0,0.3), inset 3px 3px 0 rgba(255,255,255,0.35)`,
  },
  title: {
    margin: 0,
    flexGrow: 1,
    fontFamily: fonts.pixel,
    fontSize: 11,
    lineHeight: 1.4,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: colors.ink,
  },
});

const accents = stylex.create({
  grass: { backgroundColor: colors.grass },
  gold: { backgroundColor: colors.gold },
  diamond: { backgroundColor: colors.diamond },
  amethyst: { backgroundColor: colors.amethyst },
  redstone: { backgroundColor: colors.redstone },
});
