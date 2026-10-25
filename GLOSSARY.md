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

**Flatten**:
Turning a composite's visible layers, bottom to top, into its one block plan.
_Avoid_: Merge, render, bake

**Hidden layer**:
A layer switched off; it takes no part in the flatten until switched back on.
_Avoid_: Disabled, muted

**Undo step**:
One change to a composite that undo reverses as a whole. A single gesture (a drag, a stroke, a slider scrub) makes one step; changes to the view, such as which layer is selected, make none.
_Avoid_: Action, history entry, state
