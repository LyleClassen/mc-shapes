import type { Grid } from "./grid";
import type { Point } from "./raster";

export type ParamValue = number | boolean | string;
export type ParamValues = Record<string, ParamValue>;

interface BaseParam {
  key: string;
  label: string;
  /** A function lets the hint describe the current values. */
  hint?: string | ((values: ParamValues) => string);
  /** Hide the control when it doesn't apply to the current values. */
  visible?: (values: ParamValues) => boolean;
}

export interface NumberParam extends BaseParam {
  kind: "number";
  min: number;
  /** A function lets the limit depend on other params (e.g. cut ≤ side / 2). */
  max: number | ((values: ParamValues) => number);
  step?: number;
  default: number;
  unit?: string;
  /** Notches on the slider that it snaps to; a function lets them follow other params. */
  marks?: readonly SliderMark[] | ((values: ParamValues) => readonly SliderMark[]);
  /** Keeps the value odd or even (stepping by 2), e.g. to hold a 1×1 or 2×2 centre; undefined for any. */
  parity?: (values: ParamValues) => Parity | undefined;
}

export type Parity = "odd" | "even";

export interface SliderMark {
  value: number;
  label?: string;
}

export interface ToggleParam extends BaseParam {
  kind: "toggle";
  default: boolean;
}

export interface SelectParam extends BaseParam {
  kind: "select";
  /** `icon` is an image URL shown beside the label in a dropdown. */
  options: readonly { value: string; label: string; icon?: string }[];
  default: string;
  /** Show as a dropdown rather than a row of buttons, for longer option lists. */
  dropdown?: boolean;
}

export type ParamDef = NumberParam | ToggleParam | SelectParam;

/**
 * A shape's own idea of its centre, in the same continuous space as its
 * `build` grid ([0, width] × [0, height], before trimming). `lines` are the
 * guides to draw as block lines, each running from a wall to the centre.
 */
export interface CenterHint {
  center: Point;
  /** Names these guides in the toolbar, e.g. "From cuts". */
  label: string;
  lines: readonly (readonly [Point, Point])[];
}

type ValueOf<D> = D extends { kind: "number" }
  ? number
  : D extends { kind: "toggle" }
    ? boolean
    : D extends { kind: "select"; options: readonly { value: infer V }[] }
      ? V
      : never;

export type ValuesOf<Ps extends readonly ParamDef[]> = {
  [D in Ps[number] as D["key"]]: ValueOf<D>;
};

/**
 * A shape is a self-contained module: it declares its own parameters and
 * turns their values into a solid block layout. Hollowing, trimming and
 * rendering are handled generically by the app.
 */
export interface ShapeModule {
  id: string;
  name: string;
  description: string;
  tip?: string;
  params: readonly ParamDef[];
  build(values: ParamValues): Grid;
  /** Overrides the default bounding-box centre and its straight guides. */
  center?(values: ParamValues): CenterHint;
}

/** Declares a shape with `build` typed from its own param list. */
export function defineShape<const Ps extends readonly ParamDef[]>(shape: {
  id: string;
  name: string;
  description: string;
  tip?: string;
  params: Ps;
  build(values: ValuesOf<Ps>): Grid;
  center?(values: ValuesOf<Ps>): CenterHint;
}): ShapeModule {
  return shape as unknown as ShapeModule;
}

export function resolveMax(param: NumberParam, values: ParamValues): number {
  const max = typeof param.max === "function" ? param.max(values) : param.max;
  return Math.max(param.min, max);
}

export function resolveHint(param: ParamDef, values: ParamValues): string | undefined {
  return typeof param.hint === "function" ? param.hint(values) : param.hint;
}

/**
 * The range and step the controls offer: with a parity, the ends move inward
 * to the nearest allowed value and the step doubles. Falls back to the plain
 * range when no value in it has the parity.
 */
export function resolveRange(param: NumberParam, values: ParamValues): { min: number; max: number; step: number } {
  const max = resolveMax(param, values);
  const step = param.step ?? 1;
  const parity = param.parity?.(values);
  if (!parity) return { min: param.min, max, step };
  const fits = (v: number) => (Math.abs(v) % 2 === 1) === (parity === "odd");
  const lo = fits(param.min) ? param.min : param.min + 1;
  const hi = fits(max) ? max : max - 1;
  return lo > hi ? { min: param.min, max, step } : { min: lo, max: hi, step: 2 * step };
}

/** The param's marks that fall inside its current range. */
export function resolveMarks(param: NumberParam, values: ParamValues): readonly SliderMark[] {
  const marks = typeof param.marks === "function" ? param.marks(values) : (param.marks ?? []);
  const max = resolveMax(param, values);
  return marks.filter(m => m.value >= param.min && m.value <= max);
}

/** Every 45°, labelled at the quarter turns. */
export const ROTATION_MARKS: readonly SliderMark[] = Array.from({ length: 8 }, (_, i) => ({
  value: i * 45,
  label: i % 2 === 0 ? `${i * 45}°` : undefined,
}));

export function defaultValues(params: readonly ParamDef[]): ParamValues {
  return Object.fromEntries(params.map(p => [p.key, p.default]));
}

/** Fills in missing values and clamps numbers into their (possibly dynamic) range, keeping any parity. */
export function resolveValues(params: readonly ParamDef[], input: ParamValues = {}): ParamValues {
  const values: ParamValues = { ...defaultValues(params), ...input };
  for (const p of params) {
    if (p.kind !== "number") continue;
    const v = Number(values[p.key]);
    const { min, max, step } = resolveRange(p, values);
    const clamped = Math.min(max, Math.max(min, Number.isFinite(v) ? v : p.default));
    // A value of the wrong parity rounds up to the next allowed one, or down at the top of the range.
    const off = p.parity && step % 2 === 0 ? (clamped - min) % 2 : 0;
    values[p.key] = off ? (clamped + 1 <= max ? clamped + 1 : clamped - 1) : clamped;
  }
  return values;
}
