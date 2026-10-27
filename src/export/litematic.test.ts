import { describe, expect, test } from "bun:test";
import { gridFrom, type Grid } from "../shapes/grid";
import { bitsFor, exportBlock, litematicFile, litematicNbt, packBits, type LitematicOptions } from "./litematic";

/** Reads big-endian NBT back into plain values; longs become numbers, long arrays bigints. */
function readNbt(bytes: Uint8Array): Record<string, unknown> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const utf8 = new TextDecoder();
  let at = 0;
  const u8 = () => view.getUint8(at++);
  const i32 = () => ((at += 4), view.getInt32(at - 4));
  const string = () => {
    const n = view.getUint16(at);
    at += 2 + n;
    return utf8.decode(bytes.subarray(at - n, at));
  };
  const payload = (id: number): unknown => {
    switch (id) {
      case 3:
        return i32();
      case 4: {
        const hi = i32(), lo = view.getUint32(at);
        at += 4;
        return hi * 2 ** 32 + lo;
      }
      case 8:
        return string();
      case 9: {
        const of = u8(), n = i32();
        return Array.from({ length: n }, () => payload(of));
      }
      case 10: {
        const out: Record<string, unknown> = {};
        for (let child = u8(); child; child = u8()) out[string()] = payload(child);
        return out;
      }
      case 12: {
        const n = i32();
        return Array.from({ length: n }, () => ((at += 8), view.getBigUint64(at - 8)));
      }
      default:
        throw new Error(`unexpected tag ${id}`);
    }
  };
  expect(u8()).toBe(10);
  expect(string()).toBe("");
  const root = payload(10) as Record<string, unknown>;
  expect(at).toBe(bytes.length);
  return root;
}

function unpack(longs: bigint[], bits: number, count: number): number[] {
  const mask = (1n << BigInt(bits)) - 1n;
  return Array.from({ length: count }, (_, i) => {
    const at = i * bits, l = Math.floor(at / 64), off = BigInt(at % 64);
    const joined = longs[l]! | ((longs[l + 1] ?? 0n) << 64n);
    return Number((joined >> off) & mask);
  });
}

const OPTIONS: LitematicOptions = { name: "Test", block: exportBlock("stone"), orientation: "flat", time: 1_700_000_000_123 };

// An L shape, 33 wide so the 66 bits of each row run past the first long.
const L = gridFrom(33, 3, (cx, cy) => cx < 1 || cy > 2);

type Vec = { x: number; y: number; z: number };

function region(root: Record<string, unknown>, name = "Test") {
  return (root.Regions as Record<string, Record<string, unknown>>)[name]!;
}

/** Every cell of the region's block states, as `[x, y, z]` triples of filled blocks. */
function filledCells(r: Record<string, unknown>): number[][] {
  const size = r.Size as Vec;
  const palette = r.BlockStatePalette as unknown[];
  const volume = size.x * size.y * size.z;
  const states = unpack(r.BlockStates as bigint[], bitsFor(palette.length), volume);
  const out: number[][] = [];
  states.forEach((s, i) => {
    if (!s) return;
    const x = i % size.x, z = Math.floor(i / size.x) % size.z, y = Math.floor(i / (size.x * size.z));
    out.push([x, y, z]);
  });
  return out;
}

function gridCells(grid: Grid, toXyz: (x: number, y: number) => number[]): number[][] {
  const out: number[][] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) if (grid.cells[y * grid.width + x]) out.push(toXyz(x, y));
  }
  return out.sort(byXyz);
}

const byXyz = (a: number[], b: number[]) => a[1]! - b[1]! || a[2]! - b[2]! || a[0]! - b[0]!;

describe("litematicNbt", () => {
  test("writes the header and metadata Litematica expects", () => {
    const root = readNbt(litematicNbt(L, OPTIONS));
    expect(root.MinecraftDataVersion).toBe(3953);
    expect(root.Version).toBe(6);
    expect(root.Metadata).toEqual({
      Name: "Test",
      Author: "Shape Crafter",
      Description: "33 × 3, 35 blocks",
      RegionCount: 1,
      TotalBlocks: 35,
      TotalVolume: 99,
      TimeCreated: 1_700_000_000_123,
      TimeModified: 1_700_000_000_123,
      EnclosingSize: { x: 33, y: 1, z: 3 },
    });
    const r = region(root);
    expect(r.Position).toEqual({ x: 0, y: 0, z: 0 });
    expect(r.BlockStatePalette).toEqual([{ Name: "minecraft:air" }, { Name: "minecraft:stone" }]);
    expect(r.TileEntities).toEqual([]);
    expect(r.Entities).toEqual([]);
  });

  test("flat lays the plan on the ground, grid rows along Z", () => {
    const r = region(readNbt(litematicNbt(L, OPTIONS)));
    expect(r.Size).toEqual({ x: 33, y: 1, z: 3 });
    expect((r.BlockStates as bigint[]).length).toBe(Math.ceil((99 * 2) / 64));
    expect(filledCells(r).sort(byXyz)).toEqual(gridCells(L, (x, y) => [x, 0, y]));
  });

  test("vertical stands the plan up with the top row highest", () => {
    const r = region(readNbt(litematicNbt(L, { ...OPTIONS, orientation: "vertical" })));
    expect(r.Size).toEqual({ x: 33, y: 3, z: 1 });
    expect(filledCells(r).sort(byXyz)).toEqual(gridCells(L, (x, y) => [x, 2 - y, 0]));
  });

  test("block properties go into the palette", () => {
    const r = region(readNbt(litematicNbt(L, { ...OPTIONS, block: exportBlock("deepslate") })));
    expect(r.BlockStatePalette).toEqual([
      { Name: "minecraft:air" },
      { Name: "minecraft:deepslate", Properties: { axis: "y" } },
    ]);
  });
});

describe("centre blocks", () => {
  // A 4×4 ring: the 2×2 centre falls in the hole.
  const ring = gridFrom(4, 4, (cx, cy) => cx < 1 || cx > 3 || cy < 1 || cy > 3);
  const center = { x: { start: 1, length: 2 }, y: { start: 1, length: 2 } };

  const states = (r: Record<string, unknown>) => {
    const size = r.Size as Vec;
    return unpack(r.BlockStates as bigint[], 2, size.x * size.y * size.z);
  };

  test("go in as gold blocks on top of whatever the plan has there", () => {
    const root = readNbt(litematicNbt(ring, { ...OPTIONS, center }));
    const r = region(root);
    expect(r.BlockStatePalette).toEqual([
      { Name: "minecraft:air" },
      { Name: "minecraft:stone" },
      { Name: "minecraft:gold_block" },
    ]);
    expect(states(r)).toEqual([1, 1, 1, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 1, 1, 1]);
    expect((root.Metadata as Record<string, unknown>).TotalBlocks).toBe(16);
  });

  test("replace a block they land on, and stand up with the plan", () => {
    const solid = gridFrom(3, 2, () => true);
    const top = { x: { start: 1, length: 1 }, y: { start: 0, length: 1 } };
    const r = region(readNbt(litematicNbt(solid, { ...OPTIONS, orientation: "vertical", center: top })));
    // Row 0 is the top layer (y = 1).
    expect(states(r)).toEqual([1, 1, 1, 1, 2, 1]);
  });

  test("leave the palette alone when not asked for", () => {
    expect(region(readNbt(litematicNbt(ring, OPTIONS))).BlockStatePalette).toHaveLength(2);
  });
});

describe("packBits", () => {
  test("entries wider than the space left run on into the next long", () => {
    const values = Array.from({ length: 50 }, (_, i) => (i * 5) % 8);
    const words = packBits(values, 3);
    const longs = Array.from(
      { length: words.length / 2 },
      (_, i) => (BigInt(words[i * 2 + 1]!) << 32n) | BigInt(words[i * 2]!),
    );
    expect(longs.length).toBe(3);
    expect(unpack(longs, 3, 50)).toEqual(values);
  });

  test("palettes of up to 4 entries still use 2 bits", () => {
    expect([1, 2, 3, 4, 5, 9].map(bitsFor)).toEqual([2, 2, 2, 2, 3, 4]);
  });
});

test("litematicFile gzips the NBT", async () => {
  const file = await litematicFile(L, OPTIONS);
  expect(Bun.gunzipSync(new Uint8Array(await file.arrayBuffer()))).toEqual(litematicNbt(L, OPTIONS));
});
