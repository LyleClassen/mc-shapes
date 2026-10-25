import * as stylex from "@stylexjs/stylex";
import { useEffect } from "react";
import { colors, fonts } from "../theme/tokens.stylex";

interface Props {
  variants: readonly { key: string; name: string }[];
  current: string;
  onChange: (key: string) => void;
}

/** PROTOTYPE tooling: a floating bar to flip between UI variants (← / → keys too). Never shown in production. */
export function PrototypeSwitcher({ variants, current, onChange }: Props) {
  const i = Math.max(0, variants.findIndex(v => v.key === current));
  const go = (d: number) => onChange(variants[(i + d + variants.length) % variants.length]!.key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;
  const v = variants[i]!;
  return (
    <div {...stylex.props(styles.bar)}>
      <button type="button" aria-label="Previous variant" onClick={() => go(-1)} {...stylex.props(styles.arrow)}>←</button>
      <span {...stylex.props(styles.label)}>
        {v.key} ({v.name})
      </span>
      <button type="button" aria-label="Next variant" onClick={() => go(1)} {...stylex.props(styles.arrow)}>→</button>
    </div>
  );
}

const styles = stylex.create({
  bar: {
    position: "fixed",
    bottom: 18,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingBlock: 6,
    paddingInline: 8,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    color: "#111111",
    boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
    fontFamily: fonts.body,
    fontWeight: 800,
    fontSize: 14,
  },
  label: { minWidth: 160, textAlign: "center" },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 0,
    backgroundColor: { default: "#eeeeee", ":hover": colors.gold },
    color: "#111111",
    fontSize: 16,
    fontWeight: 900,
    cursor: "pointer",
  },
});
