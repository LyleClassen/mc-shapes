import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

/**
 * A whole-number text box. Only digits can be typed, and while typing only
 * values already inside min–max are sent, so 15 on the way to 153 isn't
 * clamped to the max. Leaving the field or pressing Enter sends the clamped
 * value; Escape drops the edit; the arrow keys step (Shift for ten).
 */
export function NumberInput({
  value,
  min = -Infinity,
  max = Infinity,
  step = 1,
  onChange,
  ...props
}: Omit<ComponentProps<typeof Input>, "type" | "value" | "min" | "max" | "step" | "onChange"> & {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  const commit = (text: string) => {
    const v = Number(text);
    if (text !== "" && text !== "-" && Number.isFinite(v) && clamp(v) !== value) onChange(clamp(v));
    setDraft(null);
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={draft ?? String(value)}
      onChange={e => {
        const digits = e.target.value.replace(/[^\d]/g, "");
        const text = min < 0 && e.target.value.trimStart().startsWith("-") ? `-${digits}` : digits;
        setDraft(text);
        const v = Number(text);
        if (text !== "" && text !== "-" && v === clamp(v)) onChange(v);
      }}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setDraft(null);
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const by = (e.shiftKey ? 10 : 1) * step * (e.key === "ArrowUp" ? 1 : -1);
          setDraft(null);
          onChange(clamp(value + by));
        }
      }}
    />
  );
}
