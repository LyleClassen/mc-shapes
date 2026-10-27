# Shape Crafter

A Minecraft shape planner. Pick a shape, tweak its parameters, and get a 2D
block layout with total block count, stacks of 64, and a row-by-row placement
guide ("skip 4, place 3…") you can tick off as you build.

```bash
bun install
bun dev        # dev server with HMR
bun test       # shape geometry tests
bun run build  # production bundle in dist/
```

## Shapes are modules

Each shape lives in its own file in [src/shapes/](src/shapes/) and declares its
parameters plus a `build` function that returns a solid `Grid`:

```ts
export const circle = defineShape({
  id: "circle",
  name: "Circle",
  description: "Towers, fountains, dome layers.",
  params: [
    { kind: "number", key: "diameter", label: "Diameter", min: 1, max: 1024, default: 15 },
  ],
  build({ diameter }) {
    const r = diameter / 2;
    return gridFrom(diameter, diameter, (x, y) => (x - r) ** 2 + (y - r) ** 2 <= r * r);
  },
});
```

To add a shape, create a module and add it to `SHAPES` in
[src/shapes/index.ts](src/shapes/index.ts). The UI controls, thumbnail,
outline/thickness option, trimming, stats and row guide all come for free.

- Param kinds: `number` (slider + input), `toggle`, `select`.
- `max` can be a function of other values (e.g. corner radius ≤ half the width).
- `visible` hides a param when it doesn't apply.
- Helpers: `gridFrom` (sample cell centres), `rasterConvex` (convex polygons),
  `flipVertical`/`flipHorizontal`.

## Composite mode

The header's **Shapes | Composite** switch opens a layered editor that builds
one block plan from several live layers: shapes dragged in from the palette,
lines and eraser strokes. Each layer sees only the layers below it, and the
visible ones flatten into the same stats bar, row guide, skins and highlight
as a single shape. The terms are defined in [GLOSSARY.md](GLOSSARY.md).

- [src/composite/](src/composite/): the pure engine (`composite.ts` flattens,
  `draw.ts` holds the line, brush and rectangle geometry), layer edits and
  picking (`edit.ts`), the undo history (`history.ts`), and the editor state
  hook (`useComposite.ts`). The composite is kept in sessionStorage, but the
  undo history is in memory only.
- [src/components/composite/](src/components/composite/): the toolbar,
  stage, layer settings and Layers panel.

## Styling

Styles use [StyleX](https://stylexjs.com), compiled by the Bun plugin in
[stylex-plugin.ts](stylex-plugin.ts) (registered in `bunfig.toml` for the dev
server and in [build.ts](build.ts) for production). Theme tokens live in
[src/theme/tokens.stylex.ts](src/theme/tokens.stylex.ts).
