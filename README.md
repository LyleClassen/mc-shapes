# Shape Crafter

A Minecraft shape planner. Pick a shape, tweak its parameters, and get a 2D
block layout with total block count, stacks of 64, and a row-by-row placement
guide ("skip 4, place 3…") you can tick off as you build.

**Try it:** [mc-shapes.vercel.app](https://mc-shapes.vercel.app)

Shape Crafter is open source and community-driven. Bug reports, new shapes
and other improvements are welcome; see [Contributing](#contributing).

## Features

- **Shapes:** circle, ellipse, rectangle, triangle, truncated triangle and
  regular polygon, each with its own parameters.
- **Solid or outline** fill with an adjustable wall thickness.
- **Stats:** block count, stacks of 64 and the trimmed width × height.
- **Row guide:** a "skip / place" run list per row. Click a row to tick it
  off, or copy the whole plan as text.
- **Centre marks** (1×1 or 2×2) and centre lines to help you line up a build.
- **Highlight patterns** and block skins (grass, stone, oak, gold, diamond…)
  to preview the build.
- **Composite mode:** stack shapes, lines, eraser strokes and traced images as
  layers and flatten them into one plan.
- **Litematica export:** download the plan as a `.litematic` (Minecraft
  1.21+) in dirt, cobblestone, stone, moss, netherrack, deepslate or end
  stone, lying flat or standing up as a wall, optionally with the centre
  marked in gold blocks to help line it up.

## Local development

You need [Bun](https://bun.sh) 1.x. Node isn't needed, and there are no
environment variables to set.

```bash
git clone https://github.com/LyleClassen/mc-shapes.git
cd mc-shapes
bun install
bun dev              # dev server with HMR; open the URL it prints
```

Other scripts:

```bash
bun test             # geometry, composite and pattern tests
bun run typecheck    # tsc --noEmit
bun run build        # production bundle in dist/
bun start            # serve in production mode
```

The app deploys to Vercel from `main` (see [vercel.json](vercel.json)).

## Project structure

```
src/
  index.ts          Bun.serve entry (dev and `bun start`)
  App.tsx           top-level layout and Shapes mode
  shapes/           one module per shape, plus grid, fill, centre and pattern helpers
  composite/        the pure composite engine: layers, drawing, image tracing, undo
  components/       app components; ui/ holds the shadcn/ui primitives
  render/           canvas drawing, block skins and viewport maths
build.ts            production build
GLOSSARY.md         terms used in composite mode
```

## Adding a shape

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

Please add tests for new geometry alongside the existing ones in
[src/shapes/](src/shapes/).

## Composite mode

The header's **Shapes | Composite** switch opens a layered editor that builds
one block plan from several live layers: shapes dragged in from the palette,
lines, eraser strokes and traced images. Each layer sees only the layers below
it, and the visible ones flatten into the same stats bar, row guide, skins and
highlight as a single shape. The terms are defined in [GLOSSARY.md](GLOSSARY.md).

- [src/composite/](src/composite/): the pure engine (`composite.ts` flattens,
  `draw.ts` holds the line, brush and rectangle geometry, `image.ts` traces
  imported pictures), layer edits and picking (`edit.ts`), the undo history
  (`history.ts`), and the editor state hook (`useComposite.ts`). The composite
  is kept in sessionStorage, but the undo history is in memory only.
- [src/components/composite/](src/components/composite/): the toolbar,
  stage, layer settings and Layers panel.

## Styling

Styles use [Tailwind CSS v4](https://tailwindcss.com), compiled by
`bun-plugin-tailwind` (registered in [bunfig.toml](bunfig.toml) for the dev
server and in [build.ts](build.ts) for production). UI primitives are
[shadcn/ui](https://ui.shadcn.com) components built on
[Base UI](https://base-ui.com), in [src/components/ui/](src/components/ui/)
(configured by [components.json](components.json)). Theme colours and fonts
live in [src/index.css](src/index.css).

## Contributing

`main` is protected: every change goes in through a pull request that the
maintainer reviews and merges.

1. Fork the repo and create a branch from `main`.
2. Make your change. Keep PRs focused, one feature or fix each.
3. Check that `bun test` and `bun run typecheck` pass.
4. Open a pull request against `main` describing what changed and why.
   Screenshots help for UI changes.

For bugs or ideas, [open an issue](https://github.com/LyleClassen/mc-shapes/issues).

## License

[MIT](LICENSE) © Lyle Classen

The block textures in `src/assets/blocks/` come from Minecraft and belong to
Mojang Studios. They are not covered by the MIT licence. Shape Crafter is not
an official Minecraft product and is not approved by or associated with Mojang
or Microsoft.
