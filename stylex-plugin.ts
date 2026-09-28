import { createStylexBunPlugin } from "@stylexjs/unplugin/bun";

// StyleX compiles `stylex.create` calls at bundle time. Runtime injection keeps
// the generated CSS in sync with Bun's dev server and HMR without a separate
// CSS pipeline.
export default createStylexBunPlugin({
  dev: process.env.NODE_ENV !== "production",
  runtimeInjection: true,
  useCSSLayers: true,
  unstable_moduleResolution: { type: "commonJS", rootDir: import.meta.dir },
});
