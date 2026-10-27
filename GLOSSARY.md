# Shape Crafter

A Minecraft shape planner: shapes become flat, single-material block layouts
with counts and row-by-row placement guides.

## Language

### Shapes

**Shape**:
A parametric 2D form (circle, polygon, …) that turns its parameters into a block layout.
_Avoid_: Figure, primitive

**Block plan**:
The 2D grid of placed blocks the user builds from, with its block count and row guide. Every block is the same material.
_Avoid_: Image, picture, drawing

**Fill**:
A shape's solid-or-outline option: keep the whole shape, or only its outer walls at a chosen thickness.
_Avoid_: Using "fill" to mean painting an area

**Centre type**:
How a symmetric build centres: _1×1_ on a single block (odd sizes only), _2×2_ on a group of four (even sizes only), or _Free_ for any size. Picking one makes the size controls step by 2, so scaling keeps the centre.
_Avoid_: Centre mode, odd/even mode

**Mirror line**:
A line a block plan matches itself across, left to right or top to bottom. It runs through the middle of a 1-wide centre, or along the seam of a 2-wide one. The centre readout lists the plan's mirror lines; the dashed gold centre lines are drawn both ways whether or not the plan mirrors.
_Avoid_: Symmetry axis (in the UI)

**Export**:
A block plan saved as a Litematica schematic (`.litematic`) in one chosen block, ready to place as a hologram in game. It can include the centre block(s) as gold blocks, placed even where the plan has none, to line the build up on.
_Avoid_: Download, save (for the file itself)

**Orientation**:
Which way an export faces: _Flat_ lies on the ground with the plan's top row to the north; _Vertical_ stands up as a one-block-thick wall with the top row highest.
_Avoid_: Rotation, direction

### Composites

**Composite**:
A block plan assembled from several layers, flattened into one block plan.
_Avoid_: Scene, drawing, canvas (for the whole thing)

**Layer**:
One live item in a composite (a placed shape, a line or an eraser stroke) that keeps its own settings and can be edited at any time. Each layer sees only the layers below it.
_Avoid_: Object, element, item

**Canvas**:
The fixed-size area of a composite that layers are positioned on. Blocks outside it take no part in the flatten, and the finished block plan is trimmed from it.
_Avoid_: Board, workspace

**Position**:
Where a layer sits on the canvas: the whole-block x/y of the top-left corner of the layer's blocks. It may lie partly or wholly off the canvas.
_Avoid_: Offset, location

**Off-canvas layer**:
A layer whose blocks all fall outside the canvas. It is kept, but adds nothing to the flatten.
_Avoid_: Lost, out of bounds

**Line**:
A layer that places a straight, one-block-wide run of blocks between two endpoints. Diagonal steps join at the corners.
_Avoid_: Stroke, segment

**Eraser**:
A layer that removes blocks from the layers below it. It is made of the cells painted into it, and painted cells can be restored.
_Avoid_: Delete, clear

**Image layer** (experimental):
A layer traced from an imported picture. It keeps the picture's drawn part as a mask, so its size and trace mode can be changed at any time. It is placed by its centre block, which stays put while resizing. A picture that is roughly mirror-symmetric starts with a centre type; with one set, the trace is built from one half and mirrored, so it comes out exactly symmetric at every size.
_Avoid_: Picture layer, sprite

**Trace mode**:
How an image layer turns the picture into blocks: _Lines_ follows every drawn line one block wide; _Silhouette_ fills the outer shape (optionally closing gaps in it) and then applies Fill. Either way the picture is first straightened into segments, so straight lines come out as straight block lines; _Detail_ sets how small a corner or notch survives.
_Avoid_: Filter, effect

**Flatten**:
Turning a composite's visible layers, bottom to top, into its one block plan.
_Avoid_: Merge, render, bake

**Hidden layer**:
A layer switched off; it takes no part in the flatten until switched back on.
_Avoid_: Disabled, muted

**Undo step**:
One change to a composite that undo reverses as a whole. A single gesture (a drag, a stroke, a slider scrub) makes one step; changes to the view, such as which layer is selected, make none.
_Avoid_: Action, history entry, state
