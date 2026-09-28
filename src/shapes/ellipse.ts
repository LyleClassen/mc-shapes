import { gridFrom } from "./grid";
import { defineShape } from "./types";

export const ellipse = defineShape({
  id: "ellipse",
  name: "Ellipse",
  description: "Stretched circles for arenas and ponds.",
  params: [
    { kind: "number", key: "width", label: "Width", min: 1, max: 255, default: 25, unit: "blocks" },
    { kind: "number", key: "height", label: "Height", min: 1, max: 255, default: 15, unit: "blocks" },
  ],
  build({ width, height }) {
    const rx = width / 2;
    const ry = height / 2;
    return gridFrom(width, height, (x, y) => ((x - rx) / rx) ** 2 + ((y - ry) / ry) ** 2 <= 1);
  },
});
