import * as stylex from "@stylexjs/stylex";
import { useId } from "react";
import {
  resolveMax,
  type NumberParam,
  type ParamDef,
  type ParamValue,
  type ParamValues,
  type SelectParam,
  type ToggleParam,
} from "../shapes/types";
import { colors, fonts } from "../theme/tokens.stylex";

interface Props {
  params: readonly ParamDef[];
  values: ParamValues;
  onChange: (key: string, value: ParamValue) => void;
}

/** Renders controls for any shape's parameter list. */
export function ParamControls({ params, values, onChange }: Props) {
  return (
    <div {...stylex.props(styles.stack)}>
      {params
        .filter(p => p.visible?.(values) ?? true)
        .map(p => {
          const change = (v: ParamValue) => onChange(p.key, v);
          switch (p.kind) {
            case "number":
              return <NumberControl key={p.key} param={p} values={values} onChange={change} />;
            case "toggle":
              return <ToggleControl key={p.key} param={p} value={Boolean(values[p.key])} onChange={change} />;
            case "select":
              return <SelectControl key={p.key} param={p} value={String(values[p.key])} onChange={change} />;
          }
        })}
    </div>
  );
}

function NumberControl({
  param,
  values,
  onChange,
}: {
  param: NumberParam;
  values: ParamValues;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const value = Number(values[param.key]);
  const max = resolveMax(param, values);
  const step = param.step ?? 1;
  const set = (v: number) => onChange(Math.min(max, Math.max(param.min, v)));

  return (
    <div {...stylex.props(styles.field)}>
      <div {...stylex.props(styles.labelRow)}>
        <label htmlFor={id} {...stylex.props(styles.label)}>
          {param.label}
        </label>
        <span {...stylex.props(styles.range)}>
          {param.min}–{max}
          {param.unit ? ` ${param.unit}` : ""}
        </span>
      </div>
      <div {...stylex.props(styles.numberRow)}>
        <button type="button" aria-label={`Decrease ${param.label}`} onClick={() => set(value - step)} {...stylex.props(styles.stepper)}>
          −
        </button>
        <input
          type="range"
          min={param.min}
          max={max}
          step={step}
          value={value}
          aria-label={param.label}
          onChange={e => set(Number(e.target.value))}
          {...stylex.props(styles.slider)}
        />
        <button type="button" aria-label={`Increase ${param.label}`} onClick={() => set(value + step)} {...stylex.props(styles.stepper)}>
          +
        </button>
        <input
          id={id}
          type="number"
          min={param.min}
          max={max}
          step={step}
          value={value}
          onChange={e => {
            const v = e.target.valueAsNumber;
            if (Number.isFinite(v)) set(v);
          }}
          {...stylex.props(styles.numberInput)}
        />
      </div>
      {param.hint && <p {...stylex.props(styles.hint)}>{param.hint}</p>}
    </div>
  );
}

function ToggleControl({ param, value, onChange }: { param: ToggleParam; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      {...stylex.props(styles.toggleRow)}
    >
      <span {...stylex.props(styles.label)}>{param.label}</span>
      <span {...stylex.props(styles.track, value && styles.trackOn)}>
        <span {...stylex.props(styles.knob, value && styles.knobOn)} />
      </span>
    </button>
  );
}

function SelectControl({ param, value, onChange }: { param: SelectParam; value: string; onChange: (v: string) => void }) {
  return (
    <div {...stylex.props(styles.field)} role="radiogroup" aria-label={param.label}>
      <span {...stylex.props(styles.label)}>{param.label}</span>
      <div {...stylex.props(styles.segments)}>
        {param.options.map(o => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            {...stylex.props(styles.segment, o.value === value && styles.segmentOn)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = stylex.create({
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: 800,
    color: colors.ink,
  },
  range: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
  },
  hint: {
    margin: 0,
    fontSize: 12,
    color: colors.inkFaint,
  },
  numberRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  slider: {
    flexGrow: 1,
    minWidth: 0,
    accentColor: colors.grass,
    cursor: "pointer",
  },
  stepper: {
    width: 26,
    height: 26,
    flexShrink: 0,
    padding: 0,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
    borderRadius: 3,
    backgroundColor: { default: colors.panelSunk, ":hover": colors.panelRaised },
    color: colors.ink,
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1,
    cursor: "pointer",
    transform: { default: null, ":active": "translateY(1px)" },
  },
  numberInput: {
    width: 58,
    flexShrink: 0,
    paddingBlock: 4,
    paddingInline: 6,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: { default: colors.line, ":focus": colors.gold },
    borderRadius: 3,
    outline: "none",
    backgroundColor: colors.skyDeep,
    color: colors.gold,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: 700,
    textAlign: "right",
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    cursor: "pointer",
    textAlign: "left",
  },
  track: {
    position: "relative",
    width: 44,
    height: 22,
    borderRadius: 3,
    backgroundColor: colors.skyDeep,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.line,
    transitionProperty: "background-color",
    transitionDuration: "150ms",
  },
  trackOn: {
    backgroundColor: colors.grassDark,
    borderColor: colors.grass,
  },
  knob: {
    position: "absolute",
    top: 2,
    left: 2,
    width: 14,
    height: 14,
    backgroundColor: colors.inkSoft,
    boxShadow: "inset -2px -2px 0 rgba(0,0,0,0.25)",
    transitionProperty: "transform",
    transitionDuration: "150ms",
  },
  knobOn: {
    transform: "translateX(22px)",
    backgroundColor: colors.ink,
  },
  segments: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    padding: 3,
    borderRadius: 4,
    backgroundColor: colors.skyDeep,
  },
  segment: {
    flexGrow: 1,
    paddingBlock: 6,
    paddingInline: 10,
    borderWidth: 0,
    borderRadius: 3,
    backgroundColor: { default: "transparent", ":hover": colors.panelRaised },
    color: colors.inkSoft,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  segmentOn: {
    backgroundColor: { default: colors.grass, ":hover": colors.grass },
    color: colors.skyDeep,
    boxShadow: `inset 0 -3px 0 ${colors.grassDark}`,
  },
});
