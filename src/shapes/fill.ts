import { hollow, type Grid } from "./grid";
import type { ParamDef, ParamValues } from "./types";

/** Parameters shared by every shape, applied after the shape builds its solid form. */
export const fillParams: readonly ParamDef[] = [
  {
    kind: "select",
    key: "fill",
    label: "Fill",
    options: [
      { value: "solid", label: "Solid" },
      { value: "hollow", label: "Outline" },
    ],
    default: "solid",
  },
  {
    kind: "number",
    key: "thickness",
    label: "Wall thickness",
    min: 1,
    max: 32,
    default: 1,
    unit: "blocks",
    visible: v => v.fill === "hollow",
  },
];

export function applyFill(solid: Grid, values: ParamValues): Grid {
  return values.fill === "hollow" ? hollow(solid, Number(values.thickness)) : solid;
}
