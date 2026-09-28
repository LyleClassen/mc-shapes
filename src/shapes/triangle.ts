import { rasterConvex, rotateOutline, type Point } from "./raster";
import { defineShape } from "./types";

/** Rows needed for an equilateral triangle with the given side, in blocks. */
export function equilateralHeight(side: number): number {
  return Math.max(1, Math.round((side * Math.sqrt(3)) / 2));
}

export const triangle = defineShape({
  id: "triangle",
  name: "Triangle",
  description: "Gables, roof ends and pyramid faces.",
  params: [
    {
      kind: "select",
      key: "kind",
      label: "Type",
      options: [
        { value: "equilateral", label: "Equilateral" },
        { value: "isosceles", label: "Isosceles" },
        { value: "right", label: "Right" },
      ],
      default: "equilateral",
    },
    { kind: "number", key: "base", label: "Base", min: 1, max: 255, default: 21, unit: "blocks" },
    {
      kind: "number",
      key: "height",
      label: "Height",
      min: 1,
      max: 255,
      default: 11,
      unit: "blocks",
      visible: v => v.kind !== "equilateral",
    },
    { kind: "number", key: "rotation", label: "Rotation", hint: "Clockwise; 180° points it down", min: 0, max: 359, default: 0, unit: "°" },
  ],
  build({ kind, base, height, rotation }) {
    const h = kind === "equilateral" ? equilateralHeight(base) : height;
    const apex: Point = kind === "right" ? { x: 0, y: 0 } : { x: base / 2, y: 0 };
    const turned = rotateOutline([{ x: 0, y: h }, { x: base, y: h }, apex], rotation);
    return rasterConvex(turned.points, turned.width, turned.height);
  },
});
