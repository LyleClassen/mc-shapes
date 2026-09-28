import type { Grid } from "./grid";
import type { Point } from "./raster";

export type ParamValue = number | boolean | string;
export type ParamValues = Record<string, ParamValue>;

interface BaseParam {
  key: string;
  label: string;
  hint?: string;
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
}

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
  options: readonly { value: string; label: string }[];
  default: string;
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

/** Fills in missing values and clamps numbers into their (possibly dynamic) range. */
export function resolveValues(params: readonly ParamDef[], input: ParamValues = {}): ParamValues {
  const values: ParamValues = { ...defaultValues(params), ...input };
  for (const p of params) {
    if (p.kind !== "number") continue;
    const v = Number(values[p.key]);
    const clamped = Math.min(resolveMax(p, values), Math.max(p.min, Number.isFinite(v) ? v : p.default));
    values[p.key] = clamped;
  }
  return values;
}
