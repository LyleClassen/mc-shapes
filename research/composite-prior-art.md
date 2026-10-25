# Prior art: lines, flood fill and layers in Minecraft planners and pixel editors

Research for [#5](https://github.com/LyleClassen/mc-shapes/issues/5), under the map [#1 Composite shapes](https://github.com/LyleClassen/mc-shapes/issues/1).
Researched 2026-10-25. Vocabulary follows `GLOSSARY.md` (Layer, Canvas, Position, Eraser, Flood fill; **Fill** means solid/outline).

## Sources

Every claim below is backed by one of these primary sources (fetched on the date above):

| Tag | Source |
| --- | --- |
| A-algo | Aseprite `src/doc/algo.cpp`: `algo_line_perfect`, `algo_line_continuous` (Zingl), `*_with_fix_for_line_brush` — https://github.com/aseprite/aseprite/blob/main/src/doc/algo.cpp |
| A-intertwine | Aseprite `src/app/tools/intertwine.cpp` (`getLineAlgo`) and `intertwiners.h` (`IntertwineAsPixelPerfect`) — https://github.com/aseprite/aseprite/tree/main/src/app/tools |
| A-flood | Aseprite `src/doc/algorithm/floodfill.cpp` (`floodfill(..., contiguous, isEightConnected, ...)`) — https://github.com/aseprite/aseprite/blob/main/src/doc/algorithm/floodfill.cpp |
| A-pref | Aseprite `data/pref.xml` and `data/strings/en.ini` (option defaults and UI labels) — https://github.com/aseprite/aseprite/tree/main/data |
| A-standby | Aseprite `src/app/ui/editor/standby_state.cpp` (move cel and Auto Select Layer) — https://github.com/aseprite/aseprite/blob/main/src/app/ui/editor/standby_state.cpp |
| A-docs | Aseprite docs, Layers — https://www.aseprite.org/docs/layers/ |
| P-pixel | Piskel `src/js/utils/PixelUtils.js` (`getLinePixels`, `getUniformLinePixels`, `visitConnectedPixels`) — https://github.com/piskelapp/piskel/blob/master/src/js/utils/PixelUtils.js |
| P-tools | Piskel `src/js/tools/drawing/Stroke.js`, `PaintBucket.js`; `src/js/controller/LayersListController.js` — https://github.com/piskelapp/piskel/tree/master/src/js |
| K-fill | Krita manual, Fill Tool — https://docs.krita.org/en/reference_manual/tools/fill.html |
| D-circle | donatj Circle Generator `src/Generators/Circle.ts`, `src/Renderers/SvgRenderer.ts` — https://github.com/donatj/circle-generator |
| Plotz | Plotz home page — https://www.plotz.co.uk/ |
| MC-water | Minecraft Wiki, Water — https://minecraft.wiki/w/Water |
| Local | Two scripts run with Bun during this research (described in each section; not committed). Also this repo's `src/shapes/grid.ts` (`hollow`). |

MS Paint was in the question. Microsoft publishes no algorithm docs or source for Paint, so it isn't covered here. Any claim about it would be unsourced.

## TL;DR

- **Lines: use an 8-connected Bresenham (thin) line by default.** Both Aseprite and Piskel do this. A 4-connected flood fill can't cross an 8-connected line or outline, so no "supercover" line is needed for sealing. A thick, 4-connected staircase is only a style option. Aseprite adds one only for its line brush. donatj calls it "thick" (against "thin").
- **Flood fill: use 4-connectivity only.** It's Aseprite's default, Piskel's only mode, and how Minecraft water spreads (four horizontal neighbours). 8-connectivity leaks through every diagonal step of a thin line, and through this app's own outlines.
- **Leaks: no editor surveyed warns about them.** They clip the fill to the canvas, a selection or a grid cell. Krita's "Close Gap" is the only gap-aware feature. Our edge-leak warning is new, so it should warn without blocking: a fill that *meant* to reach the edge (a line from edge to edge) is legitimate.
- **Seed point and replay: Piskel's paint bucket already stores `{col, row, color}` and replays it** for undo and redo. That supports our "store the seed, recompute" model.
- **Layers: the panel shows the top layer first, and each row has a visibility toggle and a lock** (Aseprite, Piskel). What a fill reads is a setting in Aseprite ("Refer active layer / visible layers") and Krita ("Current Layer / All layers"). Our rule, "sees only the layers below", is a third option that's fixed rather than a setting. Hidden layers should drop out of what fills see.
- **Moving: the move tool moves the active layer unless "Auto Select Layer" is on** (Aseprite: default off, with on-canvas picking on the quick/modifier path, default on). It picks the topmost layer under the cursor in the flattened image and flashes it. Hidden or locked layers refuse to move and show a status tip.
- **Watch out: Bresenham isn't symmetric.** Swapping the endpoints changes the blocks for 56 of 169 endpoint pairs tested. Moving a line by a whole block doesn't change it. Put the endpoints in a fixed order before rasterising.
- **Minecraft planners (Plotz, donatj) have no layers, lines or flood fill.** They're parametric generators, like our current Shapes mode. Composite has no direct Minecraft precedent, so pixel editors are the right reference.

---

## 1. Line rasterisation and connectivity

### What the tools do

**Aseprite** has two integer line algorithms [A-algo]:

- `algo_line_continuous`: Alois Zingl's Bresenham (MIT, credited in a code comment). This is the usual 8-connected thin line, where each step moves in x, y or both.
- `algo_line_perfect`: steps one pixel along the major axis and moves along the minor axis as the error builds up. It's also 8-connected. Its error starts at 0 *from the origin* (the comment says so), so the result depends on which end you start from.

`getLineAlgo` [A-intertwine] picks **perfect** when Snap Angle (Shift, `kSquareAspect`) or Snap to Grid is on: "We prefer the perfect pixel lines that matches grid tiles". It picks **continuous** otherwise.

The `*_with_fix_for_line_brush` variants plot **one extra pixel at each minor-axis step**. The comment says this is "so the whole line looks continuous without holes". That turns the line 4-connected (a staircase). Aseprite uses it only for its rotated line-shaped brush, never for normal one-pixel lines.

**Pixel-perfect mode** (pref `pixel_perfect`, default `false` [A-pref]) works the other way: "We ignore a pixel that is between other two pixels in the corner of a L-like shape" [A-intertwine]. It removes L-corners from freehand strokes so they become 8-connected thin lines. Pixel-art convention prefers thin lines.

**Piskel** [P-pixel, P-tools]:

- `getLinePixels`: textbook Bresenham, 8-connected. Used for freehand interpolation and for the Stroke tool.
- `getUniformLinePixels`: used by the Stroke tool when `isStraight` (Shift is held). Its comment says "in pixel art, lines should use uniform number of pixels for each step". It rounds the slope ratio so every run has the same length, so the line no longer ends exactly where the user aimed.
- Note: `Stroke.draw_` calls `getLinePixels(col, startCol, row, startRow)`, with the *current* point first. So Piskel's own rasteriser runs from end to start.

**donatj Circle Generator** [D-circle] has three modes: `thin`, `thick` and `filled`.

- `thin`: a filled cell is kept if one of its **4** orthogonal neighbours is empty. That gives an 8-connected outline with diagonal steps.
- `thick`: a filled cell is kept if one of its **8** neighbours is empty. That gives a 4-connected outline with no diagonal-only joints.

This is the Minecraft-planner word for the same choice: "thin" means diagonal steps, "thick" means a solid staircase.

**This repo's** `hollow()` (`src/shapes/grid.ts`) finds the edge with 4-neighbours, the same way as donatj's *thin*. So our current outlines are 8-connected.

### Fill/line duality (checked locally)

Digital-topology duality: an 8-connected curve separates 4-connected regions, and the reverse holds too. The local script checked this. It draws a Zingl line across a 20×20 grid and seeds a fill on one side:

| Line | Air cells | 4-connected fill | 8-connected fill |
| --- | --- | --- | --- |
| (0,0)–(19,19) | 380 | 190 (contained) | 380 (**leaks through every diagonal step**) |
| (0,0)–(19,7) | 380 | 70 (contained) | 380 (leaks) |

### Endpoint symmetry (checked locally)

For every endpoint pair (0,0)→(x,y) with 0 ≤ x, y ≤ 12, the script rasterised A→B and B→A with Zingl's algorithm. **56 of 169** pairs gave different cell sets. Translation makes no difference, because the algorithm only uses deltas.

### Recommendations for #4 (line and eraser)

1. Use **Zingl/Bresenham, 8-connected**, as the default line. It matches both editors, needs only integers, and adding the layer's position to it gives the same blocks.
2. **Put the endpoints in a fixed order** before rasterising, e.g. always start from the lexicographically smaller (y, x). Then dragging either handle, or "reversing" a line, can't make blocks jump.
3. Optional style param later: **"Diagonal (thin)" / "Solid (thick)"**, using donatj's words. Thick = Aseprite's `fix_for_line_brush` trick (an extra block at each minor-axis step). It isn't needed for sealing (see §2). It's for builders who want walls with no corner-only joints.
4. Don't copy Piskel's uniform line by default: it moves the endpoint. A Shift-to-snap-angle (0/45/90°, or Aseprite-style "perfect") modifier is a good later addition.
5. Eraser strokes use the same rasteriser, so an erased line matches a drawn one cell for cell. A 1-block eraser line across a thin outline makes a diagonal-only gap, and a 4-connected fill still won't leak through it. An eraser that removes a *whole* block from a wall will cause a leak. That's the case the leak warning (§2) is for.

## 2. Flood fill connectivity and leak handling

### What the tools do

**Aseprite** [A-flood, A-pref]:

- `floodfill(image, mask, x, y, bounds, src_color, tolerance, contiguous, isEightConnected, …)` is a scanline fill. It's bounded by `bounds` (the canvas) and an optional selection `mask`.
- Options and their defaults:
  - **Pixel Connectivity**: 4-Connected or 8-Connected. Default `FOUR_CONNECTED`.
  - **Contiguous**: default `true`. When it's off, every matching colour in the image is replaced.
  - **Stop at Grid**: `NEVER`, `IF_VISIBLE` or `ALWAYS`. Default `NEVER`.
  - **Refer to**: "Refer active layer" or "Refer visible layers". Default the active layer.
  - **Tolerance**.
- There is no leak detection. The fill simply stops at the canvas bounds.

**Piskel** [P-pixel, P-tools]:

- `visitConnectedPixels` uses `dx = [0, 1, 0, -1]` and `dy = [-1, 0, 1, 0]`. That is **4-connected only**, with no option. Out-of-bounds lookups throw and are caught, which keeps the fill inside the frame. It also has a "Security loop breaker" at 10 × cell count.
- `PaintBucket.applyToolAt` fills the current layer's frame and then calls `raiseSaveStateEvent({col, row, color})`. `replay(frame, replayData)` re-runs the fill from that seed. **The bucket is stored as a seed and recomputed on replay**, which is close to our live flood-fill layer.

**Krita** [K-fill]:

- Reference: "Current Layer" ("Only use the currently selected layer"), "All layers" ("Use all visible layers") or "Color Labeled Layers".
- **Close Gap** (5.3): "sets the minimum gap size that the contiguous fill will be able to propagate into". This is the only feature in any tool surveyed that tries to stop leaks through small gaps.
- "Use Selection as Boundary" adds the selection border as an extra wall.

**Minecraft** [MC-water]: "Water spreads horizontally and downward into nearby air blocks". Its flow is described in terms of a block's "four horizontal neighbors". So physical containment in-game is 4-connected: a diagonal-only gap holds water. (The wiki doesn't say "no diagonal flow" in so many words. This is the closest primary statement.)

### Recommendations for #2 and #4 (flood fill)

1. **4-connected only, with no setting.** Every reference agrees: Aseprite's default, Piskel's only mode, and Minecraft's flow. It also pairs with our 8-connected lines and 4-neighbour outlines, so fills don't leak through diagonal steps. 8-connected fill would leak through every thin outline the app makes today.
2. **Leak = the fill reaches a canvas-edge cell.** No tool has this. Make it a **warning, not a refusal**: still compute the fill and show the warning on the layer row and on the canvas, e.g. by tinting the leaked region. Reason: filling the area outside a closed shape, or one side of an edge-to-edge line, is a legitimate thing to want.
3. Because fills are live, a leak can **appear later**. Example: an eraser or a moved layer below opens a gap. The warning has to be worked out on every recompute, not only when the fill is first placed. Piskel's replay-from-seed is the precedent for recomputing.
4. If the seed lands on a block (not air), make it a no-op and flag it ("seed is inside a block"). A live layer can't just "do nothing silently", because a layer moving below could put a block on the seed later.
5. Don't build "Close Gap", "Tolerance" or "Contiguous: off" yet. They don't apply to single-material grids (tolerance), or they're a later nice-to-have (gap closing).

## 3. Non-destructive layers: ordering, visibility, selection

### What the tools do

- **Aseprite** [A-docs]:
  - Layers stack in the timeline, top row = top layer.
  - Visibility is toggled per layer (Layer > Visible, Shift+X). "If the layer is locked, you cannot draw on it."
  - Rename by double-click.
  - The Background layer is opaque and "always at the bottom of the layers stack" and "cannot be moved".
  - Fills read either the active layer or all visible layers (§2).
- **Piskel** [P-tools]:
  - The layer list puts index 0 (bottom) last. `updateButtonStatus_` greys out "up" on the top layer and "down" on the bottom one.
  - Actions: move up/down (Shift = to the end), merge down, per-layer opacity. There's also a "Preview all layers" toggle (otherwise layers other than the current one are dimmed to an opacity set in preferences).
- Pixel editors' layers hold *pixels*. Nothing surveyed has live parametric layers (shape + params, line endpoints, fill seed) like ours. Merge down is destructive and doesn't fit our model.

### Recommendations for #2 (layer model) and #7 (layout prototype)

1. Layer panel: **topmost first**, with per-row **visibility** (eye) and **up/down** buttons or drag to reorder. Optionally a **lock**, which in the editors means "can't be drawn on or moved".
2. Define **"sees only the layers below" over *visible* layers.** A hidden layer drops out of the flattened grid and out of what fills and erasers above it see. This matches Aseprite's "Refer visible layers" and Krita's "All layers" ("Use all visible layers"), limited to the layers below. #2 has to say this explicitly, because hiding a layer can then change (or leak) a fill above it.
3. **Don't add merge down or flatten.** They destroy liveness. "Copy plan" already gives the flattened result.
4. Dimming non-selected layers (Piskel's preview opacity) can't be shown in a single-material plan once it's flattened. An outline or highlight of the selected layer's own cells works better. The app already has highlight rendering.

## 4. Placing and moving items

### What the tools do

- **Aseprite** [A-standby, A-pref]:
  - The Move tool moves the **active** layer's cel.
  - **Auto Select Layer**: `auto_select_layer` defaults to `false`, and `auto_select_layer_quick` (the Ctrl/⌘ quick-move path) defaults to `true`. It picks the layer under the cursor `FromComposition` (the flattened image) and calls `editor->flashCurrentLayer()` for feedback.
  - Moving is refused, with a status-bar tip, if the layer is the Background, is hidden ("layer x is hidden") or is locked.
  - `straight_line_preview` defaults to true: line tools show a preview while dragging.
- **Plotz** [Plotz]: eight parametric generators (sphere, ellipsoid, torus, ellipse, observatory, wizard tower, lighthouse, giant snowman). The home page describes no placing, layers or drawing tools.
- **donatj** [D-circle]: no placement. The renderer adds `onclick="this.classList.toggle('built')"` so builders can tick off blocks as they place them. That's a "progress" idea, not a layer one.

### Recommendations for #7 (layout prototype)

1. **Move tool = drag the selected layer.** Clicking on the canvas selects the **topmost visible layer whose own cells are under the cursor** (Aseprite's pick-from-composition), and flashes or highlights it. Ask the prototype whether this should always happen or only with a modifier. Aseprite's defaults (off for the Move tool, on for quick-move) suggest a modifier, but our layers are whole objects, so always-on may feel right.
2. Erasers and fills have no "own cells" in the usual sense. For an eraser, use the stroke path. For a fill, use its computed region, or let a fill only be picked from the layer list. The prototype should check this.
3. Refuse to drag hidden or locked layers, with a short tip, as Aseprite does.
4. Show a **live preview while drawing a line** (Aseprite default), and snap all positions to whole blocks.

## Things that should change other tickets

- **#2 Layer model**:
  - Visibility affects what layers above "see" (hidden = absent).
  - Flood fill connectivity is fixed at 4.
  - A fill's leak or no-op state is derived on every recompute, not stored.
- **#4 Line/eraser**:
  - Line endpoints must be put in a fixed order (Bresenham is direction-dependent).
  - Thin lines are enough for sealing against a 4-connected fill. "Thick" is an optional style.
- **#7 Layout prototype**:
  - Test picking a layer by clicking its cells in the flattened grid, against picking only from the layer list.
  - Test how an eraser or fill layer gets picked on the canvas.
  - Test how the leak warning looks: tinting the leaked region or a badge on the layer row.
