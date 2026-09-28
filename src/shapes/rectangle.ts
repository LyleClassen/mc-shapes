import { gridFrom } from "./grid";
import { defineShape } from "./types";

export const rectangle = defineShape({
  id: "rectangle",
  name: "Rectangle",
  description: "Floors, walls and plots, with optional rounded corners.",
  params: [
    { kind: "number", key: "width", label: "Width", min: 1, max: 255, default: 20, unit: "blocks" },
    { kind: "number", key: "height", label: "Height", min: 1, max: 255, default: 12, unit: "blocks" },
    {
      kind: "number",
      key: "radius",
      label: "Corner radius",
      min: 0,
      max: v => Math.floor(Math.min(Number(v.width), Number(v.height)) / 2),
      default: 0,
      unit: "blocks",
    },
  ],
  build({ width, height, radius }) {
    // Distance from the "inner" rectangle whose corners are the arc centres.
    const innerX = width / 2 - radius;
    const innerY = height / 2 - radius;
    return gridFrom(width, height, (x, y) => {
      const dx = Math.max(Math.abs(x - width / 2) - innerX, 0);
      const dy = Math.max(Math.abs(y - height / 2) - innerY, 0);
      return dx * dx + dy * dy <= radius * radius;
    });
  },
});
