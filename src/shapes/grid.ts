/**
 * A 2D block layout. Row-major, y = 0 is the top row. A cell is 1 when a
 * block is placed there.
 */
export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;
}

export const EMPTY_GRID: Grid = { width: 0, height: 0, cells: new Uint8Array(0) };

/**
 * Builds a grid by sampling each cell at its centre. `inside` receives the
 * centre coordinates (x + 0.5, y + 0.5), so shapes can be described in
 * continuous space with the grid spanning [0, width] × [0, height].
 */
export function gridFrom(
  width: number,
  height: number,
  inside: (cx: number, cy: number) => boolean,
): Grid {
  const cells = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inside(x + 0.5, y + 0.5)) cells[y * width + x] = 1;
    }
  }
  return { width, height, cells };
}

export function isFilled(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return false;
  return grid.cells[y * grid.width + x] === 1;
}

export function countBlocks(grid: Grid): number {
  let n = 0;
  for (const c of grid.cells) n += c;
  return n;
}

export function rowCount(grid: Grid, y: number): number {
  let n = 0;
  for (let x = 0; x < grid.width; x++) n += grid.cells[y * grid.width + x]!;
  return n;
}

export interface Span {
  start: number;
  length: number;
}

/**
 * The block(s) closest to the middle of a row or column of `size` blocks:
 * one block on odd sizes, the two either side of the midline on even sizes.
 */
export function centerSpan(size: number): Span {
  return size % 2 ? { start: (size - 1) / 2, length: 1 } : { start: size / 2 - 1, length: 2 };
}

/**
 * Block lines running out from the centre along the centre column(s) and
 * row(s), one lane per centre block, stopping where each meets the shape's
 * wall. A lane that starts in air runs up to (not into) the first block; a
 * lane that starts inside the shape runs out to its outer edge. The centre
 * defaults to the middle of the grid.
 */
export function centerGuides(
  grid: Grid,
  cx: Span = centerSpan(grid.width),
  cy: Span = centerSpan(grid.height),
): { x: number; y: number }[] {
  const { width, height } = grid;
  if (!width || !height) return [];
  const out: { x: number; y: number }[] = [];

  const walk = (x: number, y: number, dx: number, dy: number) => {
    const first = isFilled(grid, x, y);
    for (; x >= 0 && y >= 0 && x < width && y < height && isFilled(grid, x, y) === first; x += dx, y += dy) {
      out.push({ x, y });
    }
  };

  for (let x = cx.start; x < cx.start + cx.length; x++) {
    walk(x, cy.start - 1, 0, -1);
    walk(x, cy.start + cy.length, 0, 1);
  }
  for (let y = cy.start; y < cy.start + cy.length; y++) {
    walk(cx.start - 1, y, -1, 0);
    walk(cx.start + cx.length, y, 1, 0);
  }
  return out;
}

export interface Segment {
  filled: boolean;
  length: number;
}

/**
 * Describes a row as alternating gaps and block runs, reading left to right,
 * ending at the last block. Handy as placement instructions:
 * "skip 4, place 3, skip 5, place 3".
 */
export function rowSegments(grid: Grid, y: number): Segment[] {
  const segments: Segment[] = [];
  let last = -1;
  for (let x = 0; x < grid.width; x++) if (isFilled(grid, x, y)) last = x;
  for (let x = 0; x <= last; x++) {
    const filled = isFilled(grid, x, y);
    const prev = segments[segments.length - 1];
    if (prev && prev.filled === filled) prev.length++;
    else segments.push({ filled, length: 1 });
  }
  return segments;
}

/** Where the filled blocks start, i.e. how far `trim` shifts the grid. */
export function trimOffset(grid: Grid): { x: number; y: number } {
  let minX = grid.width, minY = grid.height;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (!grid.cells[y * grid.width + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
    }
  }
  return minX === grid.width ? { x: 0, y: 0 } : { x: minX, y: minY };
}

/** Removes fully empty rows and columns from the edges. */
export function trim(grid: Grid): Grid {
  let minX = grid.width, minY = grid.height, maxX = -1, maxY = -1;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (!grid.cells[y * grid.width + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return EMPTY_GRID;
  if (minX === 0 && minY === 0 && maxX === grid.width - 1 && maxY === grid.height - 1) return grid;
  return gridFrom(maxX - minX + 1, maxY - minY + 1, (cx, cy) =>
    isFilled(grid, Math.floor(cx) + minX, Math.floor(cy) + minY),
  );
}

export function flipVertical(grid: Grid): Grid {
  return gridFrom(grid.width, grid.height, (cx, cy) =>
    isFilled(grid, Math.floor(cx), grid.height - 1 - Math.floor(cy)),
  );
}

export function flipHorizontal(grid: Grid): Grid {
  return gridFrom(grid.width, grid.height, (cx, cy) =>
    isFilled(grid, grid.width - 1 - Math.floor(cx), Math.floor(cy)),
  );
}

/**
 * Keeps only the outer `thickness` layers of a shape. Distance is measured in
 * 4-connected steps, so a thickness of 1 gives the classic thin Minecraft
 * outline where diagonal steps are allowed.
 */
export function hollow(grid: Grid, thickness: number): Grid {
  const { width, height, cells } = grid;
  const dist = new Int32Array(width * height);
  const queue: number[] = [];
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!cells[y * width + x]) continue;
      if (neighbours.some(([dx, dy]) => !isFilled(grid, x + dx, y + dy))) {
        dist[y * width + x] = 1;
        queue.push(y * width + x);
      }
    }
  }

  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    const d = dist[i]!;
    if (d >= thickness) continue;
    const x = i % width, y = (i - x) / width;
    for (const [dx, dy] of neighbours) {
      if (!isFilled(grid, x + dx, y + dy)) continue;
      const j = (y + dy) * width + x + dx;
      if (dist[j] === 0) {
        dist[j] = d + 1;
        queue.push(j);
      }
    }
  }

  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = dist[i]! > 0 ? 1 : 0;
  return { width, height, cells: out };
}
