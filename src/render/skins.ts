/** Colours used to paint blocks on the canvas: a face plus bevel highlight and shadow. */
export interface Skin {
  id: string;
  name: string;
  face: string;
  light: string;
  dark: string;
}

export const SKINS: readonly Skin[] = [
  { id: "grass", name: "Grass", face: "#5fbf3a", light: "#8ee35d", dark: "#3b7d22" },
  { id: "stone", name: "Stone", face: "#8b8b93", light: "#b2b2ba", dark: "#5d5d66" },
  { id: "oak", name: "Oak Planks", face: "#b8914f", light: "#d9b574", dark: "#7f6231" },
  { id: "gold", name: "Gold", face: "#f6cd3b", light: "#fff08a", dark: "#b88a12" },
  { id: "diamond", name: "Diamond", face: "#48dcd2", light: "#a3fff5", dark: "#1e948d" },
  { id: "amethyst", name: "Amethyst", face: "#9b67e8", light: "#c9a4ff", dark: "#6538a8" },
  { id: "redstone", name: "Redstone", face: "#d8364a", light: "#ff7384", dark: "#8f1628" },
];

export function getSkin(id: string): Skin {
  return SKINS.find(s => s.id === id) ?? SKINS[0]!;
}
