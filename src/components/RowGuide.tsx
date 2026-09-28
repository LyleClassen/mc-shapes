import * as stylex from "@stylexjs/stylex";
import { memo } from "react";
import { rowCount, rowSegments, type Grid } from "../shapes/grid";
import { colors, fonts } from "../theme/tokens.stylex";

interface Props {
  grid: Grid;
  highlightRow: number | null;
  doneRows: ReadonlySet<number>;
  onHoverRow: (row: number | null) => void;
  onToggleRow: (row: number) => void;
}

/**
 * Row-by-row placement instructions: how many blocks to skip, then place,
 * reading from the left edge. Click a row to tick it off.
 */
export function RowGuide({ grid, highlightRow, doneRows, onHoverRow, onToggleRow }: Props) {
  return (
    <ol {...stylex.props(styles.list)} onPointerLeave={() => onHoverRow(null)}>
      {Array.from({ length: grid.height }, (_, y) => (
        <Row
          key={y}
          grid={grid}
          y={y}
          highlighted={highlightRow === y}
          done={doneRows.has(y)}
          onHoverRow={onHoverRow}
          onToggleRow={onToggleRow}
        />
      ))}
    </ol>
  );
}

const Row = memo(function Row({
  grid,
  y,
  highlighted,
  done,
  onHoverRow,
  onToggleRow,
}: {
  grid: Grid;
  y: number;
  highlighted: boolean;
  done: boolean;
  onHoverRow: (row: number | null) => void;
  onToggleRow: (row: number) => void;
}) {
  const segments = rowSegments(grid, y);
  return (
    <li>
      <button
        type="button"
        aria-pressed={done}
        onPointerEnter={() => onHoverRow(y)}
        onFocus={() => onHoverRow(y)}
        onClick={() => onToggleRow(y)}
        {...stylex.props(styles.row, highlighted && styles.rowHighlighted, done && styles.rowDone)}
      >
        <span {...stylex.props(styles.check, done && styles.checkOn)}>{done ? "✓" : ""}</span>
        <span {...stylex.props(styles.index)}>{y + 1}</span>
        <span {...stylex.props(styles.segments)}>
          {segments.map((s, i) => (
            <span key={i} {...stylex.props(styles.seg, s.filled ? styles.segFilled : styles.segGap)}>
              {s.filled ? s.length : `·${s.length}`}
            </span>
          ))}
        </span>
        <span {...stylex.props(styles.count)}>{rowCount(grid, y)}</span>
      </button>
    </li>
  );
});

const styles = stylex.create({
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 3,
    maxHeight: "min(68vh, 760px)",
    overflowY: "auto",
    paddingRight: 4,
  },
  row: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "18px 30px 1fr auto",
    alignItems: "center",
    gap: 8,
    paddingBlock: 5,
    paddingInline: 8,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: 4,
    backgroundColor: { default: colors.panelSunk, ":hover": colors.panelRaised },
    color: colors.ink,
    cursor: "pointer",
    textAlign: "left",
  },
  rowHighlighted: {
    borderColor: colors.gold,
    backgroundColor: { default: colors.panelRaised, ":hover": colors.panelRaised },
  },
  rowDone: {
    opacity: 0.55,
  },
  check: {
    width: 16,
    height: 16,
    display: "grid",
    placeItems: "center",
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
    borderRadius: 2,
    fontSize: 11,
    fontWeight: 900,
    color: colors.skyDeep,
  },
  checkOn: {
    backgroundColor: colors.grass,
    borderColor: colors.grass,
  },
  index: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
    textAlign: "right",
  },
  segments: {
    display: "flex",
    flexWrap: "wrap",
    gap: 3,
    minWidth: 0,
  },
  seg: {
    paddingBlock: 1,
    paddingInline: 5,
    borderRadius: 2,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  segFilled: {
    backgroundColor: colors.grass,
    color: colors.skyDeep,
    boxShadow: `inset 0 -2px 0 ${colors.grassDark}`,
  },
  segGap: {
    color: colors.inkFaint,
  },
  count: {
    fontFamily: fonts.pixel,
    fontSize: 10,
    color: colors.gold,
  },
});
