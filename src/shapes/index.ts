import { circle } from "./circle";
import { ellipse } from "./ellipse";
import { polygon } from "./polygon";
import { rectangle } from "./rectangle";
import { triangle } from "./triangle";
import { truncatedTriangle } from "./truncatedTriangle";
import type { ShapeModule } from "./types";

/** Every available shape. Add a new module here to make it show up in the app. */
export const SHAPES: readonly ShapeModule[] = [
  circle,
  ellipse,
  rectangle,
  triangle,
  truncatedTriangle,
  polygon,
];

export function getShape(id: string): ShapeModule {
  return SHAPES.find(s => s.id === id) ?? SHAPES[0]!;
}
