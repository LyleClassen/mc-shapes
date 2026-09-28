import * as stylex from "@stylexjs/stylex";

/** "Night in the Overworld": deep purple sky with ore-bright accents. */
export const colors = stylex.defineVars({
  sky: "#17123d",
  skyDeep: "#0c0924",
  panel: "#251e5a",
  panelRaised: "#332a77",
  panelSunk: "#1b1547",
  line: "#4b3fa3",
  ink: "#fff6df",
  inkSoft: "#cbc2f5",
  inkFaint: "#8f85c9",
  grass: "#72e36c",
  grassDark: "#2f8a3b",
  gold: "#ffd23f",
  goldDark: "#b9840f",
  diamond: "#52f1e5",
  diamondDark: "#1a9e98",
  redstone: "#ff5b7c",
  amethyst: "#b98cff",
  shadow: "#07051a",
});

export const fonts = stylex.defineVars({
  pixel: '"Press Start 2P", ui-monospace, monospace',
  body: '"Nunito", ui-rounded, system-ui, sans-serif',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
});
