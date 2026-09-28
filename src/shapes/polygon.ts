import { rasterConvex } from "./raster";
import { defineShape } from "./types";

export const polygon = defineShape({
  id: "polygon",
  name: "Polygon",
  description: "Regular polygons: diamonds, hexagons, octagons…",
  tip: "4 sides at 0° is a diamond; 45° is a square.",
  params: [
    { kind: "number", key: "sides", label: "Sides", min: 3, max: 16, default: 6 },
    { kind: "number", key: "diameter", label: "Diameter", min: 3, max: 255, default: 25, unit: "blocks" },
    {
      kind: "number",
      key: "rotation",
      label: "Rotation",
      min: 0,
      max: v => Math.floor(360 / Number(v.sides)) - 1,
      default: 0,
      unit: "°",
      // The rotation range is one symmetry period, so mark the flipped orientation.
      marks: v => {
        const flip = Math.round(180 / Number(v.sides));
        return [{ value: 0, label: "0°" }, { value: flip, label: `${flip}°` }];
      },
    },
  ],
  build({ sides, diameter, rotation }) {
    const r = diameter / 2;
    const points = Array.from({ length: sides }, (_, i) => {
      const angle = ((rotation - 90) * Math.PI) / 180 + (i * 2 * Math.PI) / sides;
      return { x: r + r * Math.cos(angle), y: r + r * Math.sin(angle) };
    });
    return rasterConvex(points, diameter, diameter);
  },
});
