import { gridFrom } from "./grid";
import { defineShape } from "./types";

export const circle = defineShape({
  id: "circle",
  name: "Circle",
  description: "Towers, fountains, dome layers.",
  tip: "Odd diameters have a single centre block; even ones centre on a corner.",
  params: [
    { kind: "number", key: "diameter", label: "Diameter", min: 1, max: 255, default: 15, unit: "blocks" },
  ],
  build({ diameter }) {
    const r = diameter / 2;
    return gridFrom(diameter, diameter, (x, y) => (x - r) ** 2 + (y - r) ** 2 <= r * r);
  },
});
