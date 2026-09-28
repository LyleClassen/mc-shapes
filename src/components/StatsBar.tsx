import * as stylex from "@stylexjs/stylex";
import { colors, fonts } from "../theme/tokens.stylex";

interface Props {
  blocks: number;
  solidBlocks: number;
  width: number;
  height: number;
}

const STACK = 64;
const SHULKER = 27 * STACK;

export function describeStacks(blocks: number): string {
  const stacks = Math.floor(blocks / STACK);
  const rest = blocks % STACK;
  if (stacks === 0) return `${rest} loose`;
  return rest ? `${stacks} stack${stacks > 1 ? "s" : ""} + ${rest}` : `${stacks} stack${stacks > 1 ? "s" : ""}`;
}

export function StatsBar({ blocks, solidBlocks, width, height }: Props) {
  const shulkers = blocks / SHULKER;
  const saved = solidBlocks - blocks;

  return (
    <div {...stylex.props(styles.bar)}>
      <Tile label="Blocks" value={blocks.toLocaleString()} tone="gold" big />
      <Tile label="Stacks of 64" value={describeStacks(blocks)} tone="grass" />
      <Tile label="Footprint" value={`${width} × ${height}`} tone="diamond" />
      {shulkers >= 0.5 ? (
        <Tile label="Shulker boxes" value={`≈ ${shulkers.toFixed(1)}`} tone="amethyst" />
      ) : saved > 0 ? (
        <Tile label="Saved vs solid" value={saved.toLocaleString()} tone="amethyst" />
      ) : null}
    </div>
  );
}

function Tile({ label, value, tone, big }: { label: string; value: string; tone: keyof typeof tones; big?: boolean }) {
  return (
    <div {...stylex.props(styles.tile)}>
      <span {...stylex.props(styles.label)}>{label}</span>
      <span {...stylex.props(styles.value, tones[tone], big && styles.big)}>{value}</span>
    </div>
  );
}

const styles = stylex.create({
  bar: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
  },
  tile: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 8,
    paddingBlock: 12,
    paddingInline: 14,
    backgroundColor: colors.panel,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: colors.line,
    borderRadius: 6,
    boxShadow: `4px 4px 0 ${colors.shadow}`,
  },
  label: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    color: colors.inkFaint,
  },
  value: {
    fontFamily: fonts.pixel,
    fontSize: 13,
    lineHeight: 1.5,
    fontVariantNumeric: "tabular-nums",
  },
  big: {
    fontSize: 20,
    textShadow: `3px 3px 0 ${colors.goldDark}`,
  },
});

const tones = stylex.create({
  gold: { color: colors.gold },
  grass: { color: colors.grass },
  diamond: { color: colors.diamond },
  amethyst: { color: colors.amethyst },
});
