import stylex from "./stylex-plugin";

const result = await Bun.build({
  entrypoints: ["./src/index.html"],
  outdir: "./dist",
  target: "browser",
  minify: true,
  sourcemap: "linked",
  define: { "process.env.NODE_ENV": '"production"' },
  env: "BUN_PUBLIC_*",
  plugins: [stylex],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

for (const output of result.outputs) console.log(`  ${output.path}`);
