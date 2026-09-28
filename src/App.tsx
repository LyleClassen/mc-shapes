import * as stylex from "@stylexjs/stylex";
import { useCallback, useMemo, useState } from "react";
import { BlockStage, type Cell } from "./components/BlockStage";
import { Panel } from "./components/Panel";
import { ParamControls } from "./components/ParamControls";
import { RowGuide } from "./components/RowGuide";
import { ShapePicker } from "./components/ShapePicker";
import { SkinPicker } from "./components/SkinPicker";
import { describeStacks, StatsBar } from "./components/StatsBar";
import { getSkin, SKINS } from "./render/skins";
import { applyFill, fillParams } from "./shapes/fill";
import { centerMarks, effectiveGuideMode, guideCells, guideParam, type GuideMode } from "./shapes/center";
import { countBlocks, isFilled, rowCount, trim, trimOffset, type Grid } from "./shapes/grid";
import { getShape, SHAPES } from "./shapes";
import { defaultValues, resolveValues, type ParamValue, type ParamValues } from "./shapes/types";
import { colors, fonts } from "./theme/tokens.stylex";

export function App() {
  const [shapeId, setShapeId] = useState(SHAPES[0]!.id);
  const [valuesById, setValuesById] = useState<Record<string, ParamValues>>(() =>
    Object.fromEntries(SHAPES.map(s => [s.id, defaultValues(s.params)])),
  );
  const [fillInput, setFillInput] = useState<ParamValues>(() => defaultValues(fillParams));
  const [skinId, setSkinId] = useState(SKINS[0]!.id);
  const [guideMode, setGuideMode] = useState<GuideMode>("straight");
  const [hover, setHover] = useState<Cell | null>(null);
  const [listRow, setListRow] = useState<number | null>(null);
  const [done, setDone] = useState<{ plan: string; rows: ReadonlySet<number> }>({ plan: "", rows: new Set() });

  const shape = getShape(shapeId);
  const values = resolveValues(shape.params, valuesById[shapeId]);
  const fill = resolveValues(fillParams, fillInput);
  const plan = JSON.stringify([shapeId, values, fill]);

  const { solid, grid, center } = useMemo(() => {
    const built = shape.build(values);
    const solid = trim(built);
    const grid = applyFill(solid, fill);
    return { solid, grid, center: centerMarks(grid, shape.center?.(values), trimOffset(built)) };
    // `plan` captures every input to the build.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const doneRows = done.plan === plan ? done.rows : EMPTY_SET;
  const highlightRow = listRow ?? hover?.y ?? null;

  const setParam = (key: string, value: ParamValue) =>
    setValuesById(prev => ({ ...prev, [shapeId]: { ...values, [key]: value } }));

  const toggleRow = useCallback(
    (row: number) =>
      setDone(prev => {
        const rows = new Set(prev.plan === plan ? prev.rows : []);
        if (rows.has(row)) rows.delete(row);
        else rows.add(row);
        return { plan, rows };
      }),
    [plan],
  );

  const blocks = countBlocks(grid);

  return (
    <div {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.logo)} aria-hidden>
          <span {...stylex.props(styles.logoBlock, styles.logoGrass)} />
          <span {...stylex.props(styles.logoBlock, styles.logoGold)} />
          <span {...stylex.props(styles.logoBlock, styles.logoDiamond)} />
        </div>
        <div>
          <h1 {...stylex.props(styles.title)}>Shape Crafter</h1>
          <p {...stylex.props(styles.tagline)}>Plan circles, triangles and more — block by block.</p>
        </div>
      </header>

      <main {...stylex.props(styles.layout)}>
        <aside {...stylex.props(styles.sidebar)}>
          <Panel title="Shape" accent="grass">
            <ShapePicker shapes={SHAPES} selected={shapeId} onSelect={setShapeId} />
          </Panel>

          <Panel title={shape.name} accent="gold">
            <p {...stylex.props(styles.description)}>{shape.description}</p>
            <ParamControls params={shape.params} values={values} onChange={setParam} />
            <ParamControls
              params={[guideParam(center)]}
              values={{ guides: effectiveGuideMode(guideMode, center) }}
              onChange={(_, value) => setGuideMode(value as GuideMode)}
            />
            {shape.tip && (
              <p {...stylex.props(styles.tip)}>
                <b {...stylex.props(styles.tipLabel)}>Tip</b> {shape.tip}
              </p>
            )}
          </Panel>

          <Panel title="Fill & block" accent="amethyst">
            <ParamControls
              params={fillParams}
              values={fill}
              onChange={(key, value) => setFillInput(prev => ({ ...prev, [key]: value }))}
            />
            <SkinPicker skins={SKINS} selected={skinId} onSelect={setSkinId} />
          </Panel>
        </aside>

        <section {...stylex.props(styles.center)}>
          <StatsBar blocks={blocks} solidBlocks={countBlocks(solid)} width={grid.width} height={grid.height} />
          <BlockStage
            grid={grid}
            center={center}
            guides={guideCells(guideMode, center)}
            skin={getSkin(skinId)}
            highlightRow={highlightRow}
            doneRows={doneRows}
            hover={hover}
            onHover={setHover}
          />
        </section>

        <Panel
          title="Row guide"
          accent="diamond"
          xstyle={styles.rows}
          action={<CopyButton text={() => planText(shape.name, values, fill, grid)} />}
        >
          <p {...stylex.props(styles.legend)}>
            <span {...stylex.props(styles.legendGap)}>·4</span> skip 4 ·{" "}
            <span {...stylex.props(styles.legendFill)}>3</span> place 3 · click a row to tick it off
            {doneRows.size > 0 && ` · ${doneRows.size}/${grid.height} done`}
          </p>
          <RowGuide
            grid={grid}
            highlightRow={highlightRow}
            doneRows={doneRows}
            onHoverRow={setListRow}
            onToggleRow={toggleRow}
          />
        </Panel>
      </main>
    </div>
  );
}

const EMPTY_SET: ReadonlySet<number> = new Set();

function planText(name: string, values: ParamValues, fill: ParamValues, grid: Grid): string {
  const params = Object.entries(values).map(([k, v]) => `${k}=${v}`).join(", ");
  const fillText = fill.fill === "hollow" ? `outline, ${fill.thickness} thick` : "solid";
  const blocks = countBlocks(grid);
  const pad = String(grid.height).length;
  const rows = Array.from({ length: grid.height }, (_, y) => {
    let line = "";
    for (let x = 0; x < grid.width; x++) line += isFilled(grid, x, y) ? "█" : "·";
    return `${String(y + 1).padStart(pad)} ${line}  ${rowCount(grid, y)}`;
  });
  return [
    `${name} (${params}) — ${fillText}`,
    `${grid.width} × ${grid.height}, ${blocks} blocks (${describeStacks(blocks)})`,
    "",
    ...rows,
  ].join("\n");
}

function CopyButton({ text }: { text: () => string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text());
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      {...stylex.props(styles.copy, copied && styles.copied)}
    >
      {copied ? "Copied!" : "Copy plan"}
    </button>
  );
}

const bob = stylex.keyframes({
  "0%": { transform: "translateY(0)" },
  "50%": { transform: "translateY(-5px)" },
  "100%": { transform: "translateY(0)" },
});

const NARROW = "@media (max-width: 1180px)";
const PHONE = "@media (max-width: 760px)";

const styles = stylex.create({
  page: {
    maxWidth: 1600,
    marginInline: "auto",
    paddingBlock: 28,
    paddingInline: { default: 28, [PHONE]: 16 },
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },
  logo: {
    display: "flex",
    alignItems: "flex-end",
    gap: 4,
  },
  logoBlock: {
    width: 22,
    height: 22,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: colors.shadow,
    boxShadow: "inset 4px 4px 0 rgba(255,255,255,0.35), inset -4px -4px 0 rgba(0,0,0,0.3)",
    animationName: bob,
    animationDuration: "2.4s",
    animationIterationCount: "infinite",
    animationTimingFunction: "steps(4)",
  },
  logoGrass: { backgroundColor: colors.grass },
  logoGold: { backgroundColor: colors.gold, animationDelay: "0.3s", height: 30 },
  logoDiamond: { backgroundColor: colors.diamond, animationDelay: "0.6s" },
  title: {
    margin: 0,
    fontFamily: fonts.pixel,
    fontSize: { default: 28, [PHONE]: 18 },
    lineHeight: 1.3,
    color: colors.ink,
    textShadow: `3px 3px 0 ${colors.redstone}, 6px 6px 0 ${colors.shadow}`,
  },
  tagline: {
    marginTop: 8,
    marginBottom: 0,
    fontSize: 15,
    fontWeight: 700,
    color: colors.inkSoft,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: {
      default: "340px minmax(0, 1fr) 320px",
      [NARROW]: "320px minmax(0, 1fr)",
      [PHONE]: "minmax(0, 1fr)",
    },
    alignItems: "start",
    gap: 20,
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    minWidth: 0,
  },
  center: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    minWidth: 0,
  },
  rows: {
    gridColumn: { default: "auto", [NARROW]: "1 / -1" },
  },
  description: {
    margin: 0,
    fontSize: 14,
    color: colors.inkSoft,
  },
  tip: {
    margin: 0,
    paddingBlock: 10,
    paddingInline: 12,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftStyle: "solid",
    borderLeftColor: colors.gold,
    backgroundColor: colors.panelSunk,
    fontSize: 13,
    lineHeight: 1.45,
    color: colors.inkSoft,
  },
  tipLabel: {
    marginRight: 6,
    fontFamily: fonts.pixel,
    fontSize: 9,
    color: colors.gold,
  },
  legend: {
    margin: 0,
    fontSize: 12,
    color: colors.inkFaint,
  },
  legendGap: {
    fontFamily: fonts.mono,
    fontWeight: 700,
  },
  legendFill: {
    fontFamily: fonts.mono,
    fontWeight: 700,
    paddingInline: 4,
    borderRadius: 2,
    backgroundColor: colors.grass,
    color: colors.skyDeep,
  },
  copy: {
    paddingBlock: 5,
    paddingInline: 10,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.diamond,
    borderRadius: 3,
    backgroundColor: { default: "transparent", ":hover": colors.diamondDark },
    color: colors.diamond,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  copied: {
    backgroundColor: { default: colors.diamond, ":hover": colors.diamond },
    color: colors.skyDeep,
  },
});
