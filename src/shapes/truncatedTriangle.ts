import { lerp, rasterConvex, rotateOutline, type Point } from "./raster";
import { equilateralHeight } from "./triangle";
import { defineShape } from "./types";

export const truncatedTriangle = defineShape({
  id: "truncated-triangle",
  name: "Truncated Triangle",
  description: "An equilateral triangle with its corners sliced off.",
  tip: "All corners with cut = side ÷ 3 gives a regular hexagon. Top only makes a trapezoid whose flat top is the cut length.",
  params: [
    { kind: "number", key: "side", label: "Side length", min: 3, max: 255, default: 30, unit: "blocks" },
    {
      kind: "select",
      key: "corners",
      label: "Truncate",
      options: [
        { value: "all", label: "All corners" },
        { value: "top", label: "Top only" },
      ],
      default: "all",
    },
    {
      kind: "number",
      key: "cut",
      label: "Cut length",
      hint: "How far along each side the cut starts",
      min: 0,
      max: v => (v.corners === "all" ? Math.floor((Number(v.side) - 1) / 2) : Number(v.side) - 1),
      default: 6,
      unit: "blocks",
    },
    { kind: "number", key: "rotation", label: "Rotation", hint: "Clockwise; 180° points it down", min: 0, max: 359, default: 0, unit: "°" },
  ],
  build({ side, corners, cut, rotation }) {
    const turned = rotateOutline(outlineOf(side, corners, cut), rotation, frameOf(side));
    return rasterConvex(turned.points, turned.width, turned.height);
  },
  // Centre is the triangle's centroid: where lines at right angles to each
  // cut, from the cut's midpoint, meet. An uncut corner contributes a line
  // from the corner itself (a zero-length cut).
  center({ side, corners, cut, rotation }) {
    const { left, right, apex, h } = triangleCorners(side);
    const t = cut / side;
    const cutMid = (corner: Point, a: Point, b: Point) => lerp(lerp(corner, a, t), lerp(corner, b, t), 0.5);
    const center: Point = { x: side / 2, y: (2 * h) / 3 };
    const starts =
      corners === "all"
        ? [cutMid(apex, left, right), cutMid(left, right, apex), cutMid(right, left, apex)]
        : [cutMid(apex, left, right), left, right];
    // Turn exactly as `build` does so the guides land on its grid.
    const { apply } = rotateOutline(outlineOf(side, corners, cut), rotation, frameOf(side));
    return { center: apply(center), label: "From cuts", lines: starts.map(s => [apply(s), apply(center)] as const) };
  },
});

function triangleCorners(side: number) {
  const h = equilateralHeight(side);
  return { h, left: { x: 0, y: h }, right: { x: side, y: h }, apex: { x: side / 2, y: 0 } };
}

/** The uncut triangle, which sets the grid's box. */
function frameOf(side: number): Point[] {
  const { left, right, apex } = triangleCorners(side);
  return [left, right, apex];
}

/**
 * Walks the triangle's edges, replacing each truncated corner with the two
 * points where the cut meets the adjacent sides.
 */
function outlineOf(side: number, corners: "all" | "top", cut: number): Point[] {
  const { left, right, apex } = triangleCorners(side);
  const t = cut / side;
  return corners === "all"
    ? [
        lerp(left, right, t),
        lerp(right, left, t),
        lerp(right, apex, t),
        lerp(apex, right, t),
        lerp(apex, left, t),
        lerp(left, apex, t),
      ]
    : [left, right, lerp(apex, right, t), lerp(apex, left, t)];
}
