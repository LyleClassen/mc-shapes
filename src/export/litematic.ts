import cobblestone from "../assets/blocks/cobblestone.png";
import deepslate from "../assets/blocks/deepslate.png";
import dirt from "../assets/blocks/dirt.png";
import endStone from "../assets/blocks/end_stone.png";
import moss from "../assets/blocks/moss_block.png";
import netherrack from "../assets/blocks/netherrack.png";
import stone from "../assets/blocks/stone.png";
import { isFilled, type Grid, type Span } from "../shapes/grid";
import type { ParamDef } from "../shapes/types";

/** A Minecraft block state as it appears in a schematic's palette. */
export interface BlockState {
  Name: string;
  Properties?: Record<string, string>;
}

export const EXPORT_BLOCKS = [
  { id: "dirt", label: "Dirt", icon: dirt, state: { Name: "minecraft:dirt" } },
  { id: "cobblestone", label: "Cobblestone", icon: cobblestone, state: { Name: "minecraft:cobblestone" } },
  { id: "stone", label: "Stone", icon: stone, state: { Name: "minecraft:stone" } },
  { id: "moss", label: "Moss", icon: moss, state: { Name: "minecraft:moss_block" } },
  { id: "netherrack", label: "Netherrack", icon: netherrack, state: { Name: "minecraft:netherrack" } },
  {
    id: "deepslate",
    label: "Deepslate",
    icon: deepslate,
    state: { Name: "minecraft:deepslate", Properties: { axis: "y" } },
  },
  { id: "end_stone", label: "End stone", icon: endStone, state: { Name: "minecraft:end_stone" } },
] as const satisfies readonly { id: string; label: string; icon: string; state: BlockState }[];

export type Orientation = "flat" | "vertical";

export const exportParams: readonly ParamDef[] = [
  {
    kind: "select",
    key: "block",
    label: "Block",
    options: EXPORT_BLOCKS.map(b => ({ value: b.id, label: b.label, icon: b.icon })),
    default: "stone",
    dropdown: true,
  },
  {
    kind: "select",
    key: "orientation",
    label: "Orientation",
    options: [
      { value: "flat", label: "Flat" },
      { value: "vertical", label: "Vertical" },
    ],
    default: "flat",
    hint: v =>
      v.orientation === "vertical"
        ? "Stands up as a wall, top row highest."
        : "Lies on the ground, top row to the north.",
  },
  { kind: "toggle", key: "center", label: "Include centre blocks", default: false },
];

export function exportBlock(id: string): BlockState {
  return (EXPORT_BLOCKS.find(b => b.id === id) ?? EXPORT_BLOCKS[2]).state;
}

/** Marks the centre in gold, as the stage does, so it stands out against every export block. */
export const CENTER_BLOCK: BlockState = { Name: "minecraft:gold_block" };

/** Minecraft 1.21. Litematica upgrades older files on load but refuses newer ones. */
const DATA_VERSION = 3953;
/** Litematica's schematic format for 1.20.5 and later. */
const SCHEMATIC_VERSION = 6;

export interface LitematicOptions {
  /** Schematic and region name, shown in Litematica's browser. */
  name: string;
  block: BlockState;
  orientation: Orientation;
  /** The plan's centre block(s), placed as `CENTER_BLOCK` whether they fall on a block or in the air. */
  center?: { x: Span; y: Span };
  /** Creation time in ms; defaults to now. */
  time?: number;
}

/**
 * The block plan as an uncompressed Litematica schematic: one region holding
 * every filled cell as `block`. Flat maps grid x → X and grid y → Z; vertical
 * maps grid x → X and stands the rows up along Y with row 0 on top.
 */
export function litematicNbt(
  grid: Grid,
  { name, block, orientation, center, time = Date.now() }: LitematicOptions,
): Uint8Array<ArrayBuffer> {
  const { width, height } = grid;
  const size = orientation === "vertical" ? { x: width, y: height, z: 1 } : { x: width, y: 1, z: height };
  const volume = width * height;
  const inSpan = (v: number, span: Span) => v >= span.start && v < span.start + span.length;
  const isCenter = (x: number, y: number) => !!center && inSpan(x, center.x) && inSpan(y, center.y);

  // Palette index 0 must be air. Cells are ordered x fastest, then z, then y.
  const palette = center ? [{ Name: "minecraft:air" }, block, CENTER_BLOCK] : [{ Name: "minecraft:air" }, block];
  const states = new Uint8Array(volume);
  let blocks = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const state = isCenter(x, y) ? 2 : isFilled(grid, x, y) ? 1 : 0;
      if (!state) continue;
      states[orientation === "vertical" ? (height - 1 - y) * width + x : y * width + x] = state;
      blocks++;
    }
  }

  const vec = (v: { x: number; y: number; z: number }) => compound({ x: int(v.x), y: int(v.y), z: int(v.z) });
  const region = compound({
    Position: vec({ x: 0, y: 0, z: 0 }),
    Size: vec(size),
    BlockStatePalette: list(10, palette.map(blockStateTag)),
    BlockStates: longArray(packBits(states, bitsFor(palette.length))),
    TileEntities: list(10, []),
    Entities: list(10, []),
    PendingBlockTicks: list(10, []),
    PendingFluidTicks: list(10, []),
  });

  const root = compound({
    MinecraftDataVersion: int(DATA_VERSION),
    Version: int(SCHEMATIC_VERSION),
    SubVersion: int(1),
    Metadata: compound({
      Name: str(name),
      Author: str("Shape Crafter"),
      Description: str(`${width} × ${height}, ${blocks} blocks`),
      RegionCount: int(1),
      TotalBlocks: int(blocks),
      TotalVolume: int(volume),
      TimeCreated: long(time),
      TimeModified: long(time),
      EnclosingSize: vec(size),
    }),
    Regions: compound({ [name]: region }),
  });
  return encodeNbt(root);
}

/** The gzipped `.litematic` file, ready to download. */
export async function litematicFile(grid: Grid, options: LitematicOptions): Promise<Blob> {
  const stream = new Blob([litematicNbt(grid, options)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

/** Litematica stores palette indices in at least 2 bits each. */
export function bitsFor(paletteSize: number): number {
  return Math.max(2, Math.ceil(Math.log2(paletteSize)));
}

/**
 * Packs values `bits` wide into 64-bit longs, lowest bits first, letting an
 * entry run on into the next long (Litematica's `LitematicaBitArray`). Each long
 * is returned as two 32-bit words, low word first.
 */
export function packBits(values: ArrayLike<number>, bits: number): Uint32Array {
  const words = new Uint32Array(Math.ceil((values.length * bits) / 64) * 2);
  for (let i = 0; i < values.length; i++) {
    const at = i * bits, w = at >>> 5, off = at & 31;
    words[w]! |= values[i]! << off;
    if (off + bits > 32) words[w + 1]! |= values[i]! >>> (32 - off);
  }
  return words;
}

function blockStateTag(state: BlockState): Tag {
  const entries: Record<string, Tag> = { Name: str(state.Name) };
  if (state.Properties) {
    entries.Properties = compound(Object.fromEntries(Object.entries(state.Properties).map(([k, v]) => [k, str(v)])));
  }
  return compound(entries);
}

// A minimal NBT writer: only the tags a schematic needs.

type Tag =
  | { id: 3; value: number }
  | { id: 4; value: number }
  | { id: 8; value: string }
  | { id: 9; of: number; items: Tag[] }
  | { id: 10; entries: Record<string, Tag> }
  | { id: 12; words: Uint32Array };

const int = (value: number): Tag => ({ id: 3, value });
const long = (value: number): Tag => ({ id: 4, value });
const str = (value: string): Tag => ({ id: 8, value });
const list = (of: number, items: Tag[]): Tag => ({ id: 9, of, items });
const compound = (entries: Record<string, Tag>): Tag => ({ id: 10, entries });
const longArray = (words: Uint32Array): Tag => ({ id: 12, words });

/** Big-endian NBT with an unnamed root compound, as Java Edition writes it. */
function encodeNbt(root: Tag): Uint8Array<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  const utf8 = new TextEncoder();
  const fixed = (n: number, write: (view: DataView) => void) => {
    const bytes = new Uint8Array(n);
    write(new DataView(bytes.buffer));
    chunks.push(bytes);
  };
  const string = (s: string) => {
    const bytes = utf8.encode(s);
    fixed(2, v => v.setUint16(0, bytes.length));
    chunks.push(bytes);
  };
  const payload = (tag: Tag) => {
    switch (tag.id) {
      case 3:
        return fixed(4, v => v.setInt32(0, tag.value));
      case 4:
        return fixed(8, v => {
          v.setUint32(0, Math.floor(tag.value / 2 ** 32));
          v.setUint32(4, tag.value >>> 0);
        });
      case 8:
        return string(tag.value);
      case 9:
        fixed(5, v => {
          v.setUint8(0, tag.items.length ? tag.of : 0);
          v.setInt32(1, tag.items.length);
        });
        return tag.items.forEach(payload);
      case 10:
        for (const [name, child] of Object.entries(tag.entries)) {
          fixed(1, v => v.setUint8(0, child.id));
          string(name);
          payload(child);
        }
        return fixed(1, v => v.setUint8(0, 0));
      case 12: {
        const longs = tag.words.length / 2;
        return fixed(4 + longs * 8, v => {
          v.setInt32(0, longs);
          for (let i = 0; i < longs; i++) {
            v.setUint32(4 + i * 8, tag.words[i * 2 + 1]!);
            v.setUint32(8 + i * 8, tag.words[i * 2]!);
          }
        });
      }
    }
  };

  fixed(1, v => v.setUint8(0, root.id));
  string("");
  payload(root);

  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
