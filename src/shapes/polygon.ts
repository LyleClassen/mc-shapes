import { trim } from "./grid";
import { lerp, rasterConvex, type Point } from "./raster";
import { defineShape, type ParamValues } from "./types";

type Measure = "corners" | "flats" | "footprint";

const EPSILON = 1e-9;

export const polygon = defineShape({
  id: "polygon",
  name: "Polygon",
  description: "Regular polygons: diamonds, hexagons, octagons…",
  tip: "4 sides at 0° is a diamond; 45° is a square. Measure by Footprint to keep the size fixed while you rotate.",
  params: [
    { kind: "number", key: "sides", label: "Sides", min: 3, max: 16, default: 6 },
    {
      kind: "select",
      key: "measure",
      label: "Measure",
      options: [
        { value: "corners", label: "Corners" },
        { value: "flats", label: "Flats" },
        { value: "footprint", label: "Footprint" },
      ],
      default: "corners",
      hint: v => MEASURE_HINTS[v.measure as Measure](Number(v.sides)),
    },
    {
      kind: "number",
      key: "diameter",
      label: "Diameter",
      min: 3,
      max: 255,
      default: 25,
      unit: "blocks",
      hint: v => {
        const grid = trim(rasterOf(v));
        return `Builds ${grid.width} × ${grid.height} at this rotation`;
      },
    },
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
  build: values => rasterOf(values),
  // Centre is the circumcentre; the guides run along whatever Diameter measures.
  center(values) {
    const { points, center } = outlineOf(values);
    const ends = measuredEnds(values, points, center);
    return { center, label: "Diameter", lines: ends.map(p => [p, center] as const) };
  },
});

const MEASURE_HINTS: Record<Measure, (sides: number) => string> = {
  corners: sides => (sides % 2 ? "Diameter is the circle through the corners" : "Diameter runs corner to corner"),
  flats: sides => (sides % 2 ? "Diameter runs from a corner to the opposite flat" : "Diameter runs flat to flat"),
  footprint: () => "Diameter is the widest side, at any rotation",
};

interface PolygonValues {
  sides: number;
  measure: Measure;
  diameter: number;
  rotation: number;
}

function rasterOf(values: ParamValues) {
  const { points, width, height } = outlineOf(values);
  return rasterConvex(points, width, height);
}

/**
 * Corners turned to `rotation` and sized so the chosen measure spans
 * `diameter`, centred so that span covers exactly `diameter` blocks.
 */
function outlineOf(values: ParamValues) {
  const { sides, measure, diameter, rotation } = values as unknown as PolygonValues;
  const unit = Array.from({ length: sides }, (_, i): Point => {
    const angle = ((rotation - 90) * Math.PI) / 180 + (i * 2 * Math.PI) / sides;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });

  if (measure === "footprint") {
    const xs = unit.map(p => p.x), ys = unit.map(p => p.y);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    // The box's middle stays in the middle of a fixed diameter × diameter grid,
    // so growing the polygon can only add blocks.
    const at = (r: number) => {
      const center = { x: diameter / 2 - (r * (minX + maxX)) / 2, y: diameter / 2 - (r * (minY + maxY)) / 2 };
      return { points: unit.map(p => ({ x: center.x + p.x * r, y: center.y + p.y * r })), center, width: diameter, height: diameter };
    };
    const widest = (r: number) => {
      const grid = trim(rasterConvex(at(r).points, diameter, diameter));
      return Math.max(grid.width, grid.height);
    };
    // A sharp corner touching the box rarely covers a block centre, so grow
    // the polygon (by under a block) just until its widest side fills `diameter`.
    let lo = diameter / Math.max(maxX - minX, maxY - minY);
    let hi = lo * (1 + 1 / diameter);
    if (widest(lo) < diameter) {
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        if (widest(mid) < diameter) lo = mid;
        else hi = mid;
      }
      lo = hi;
    }
    return at(lo);
  }

  // Odd polygons measured across the flats are lopsided about their centre,
  // so it's the midpoint of the measured span that sits in the middle.
  const flat = Math.cos(Math.PI / sides);
  const odd = sides % 2 === 1;
  const r = measure === "corners" ? diameter / 2 : odd ? diameter / (1 + flat) : diameter / 2 / flat;
  const lean = measure === "flats" && odd ? scale(unit[measuredAxis(unit, { x: 0, y: 0 }, measure)]!, (r * (1 - flat)) / 2) : { x: 0, y: 0 };
  // Whole blocks of padding keep the span's parity, so it still lands on `diameter` blocks.
  const pad = Math.max(0, Math.ceil(r + Math.hypot(lean.x, lean.y) - diameter / 2 - EPSILON));
  const size = diameter + 2 * pad;
  const center = { x: size / 2 - lean.x, y: size / 2 - lean.y };
  return { points: unit.map(p => ({ x: center.x + p.x * r, y: center.y + p.y * r })), center, width: size, height: size };
}

/** The two points whose distance the Diameter sets. */
function measuredEnds(values: ParamValues, points: readonly Point[], center: Point): Point[] {
  const { measure } = values as unknown as PolygonValues;
  const n = points.length;
  const edgeMid = (i: number) => lerp(points[i % n]!, points[(i + 1) % n]!, 0.5);

  if (measure === "footprint") {
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const wide = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
    const along = wide ? xs : ys;
    // An edge can lie along the box's side; aim at its middle rather than one end.
    const extreme = (v: number) => {
      const hits = points.filter((_, i) => Math.abs(along[i]! - v) < 1e-6);
      return scale(hits.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 }), 1 / hits.length);
    };
    return [extreme(Math.min(...along)), extreme(Math.max(...along))];
  }
  const pair = (i: number): [Point, Point] =>
    n % 2
      ? [points[i]!, edgeMid(i + (n - 1) / 2)]
      : measure === "corners"
        ? [points[i]!, points[i + n / 2]!]
        : [edgeMid(i), edgeMid(i + n / 2)];
  return pair(measuredAxis(points, center, measure));
}

/**
 * Every corner-to-corner (or flat-to-flat) pair is the same length, so
 * measure along the one closest to a grid axis, where it reads as a run of
 * blocks. Returns the index of the pair's first corner or flat.
 */
function measuredAxis(points: readonly Point[], center: Point, measure: Measure): number {
  const n = points.length;
  // A pair runs through the centre and its first corner, or its first flat's middle.
  const through = (i: number) =>
    measure === "flats" && n % 2 === 0 ? lerp(points[i]!, points[(i + 1) % n]!, 0.5) : points[i]!;
  let best = 0, bestOff = Infinity;
  for (let i = 0; i < (n % 2 ? n : n / 2); i++) {
    const p = through(i);
    // How far the pair is from the nearest quarter turn.
    const off = Math.abs(Math.sin(2 * Math.atan2(p.y - center.y, p.x - center.x)));
    if (off < bestOff - 1e-9) [best, bestOff] = [i, off];
  }
  return best;
}

function scale(p: Point, k: number): Point {
  return { x: p.x * k, y: p.y * k };
}
