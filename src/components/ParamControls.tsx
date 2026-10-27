import { MinusIcon, PlusIcon } from "lucide-react";
import { useId } from "react";
import {
  resolveHint,
  resolveMarks,
  resolveRange,
  type NumberParam,
  type ParamDef,
  type ParamValue,
  type ParamValues,
  type SelectParam,
  type ToggleParam,
} from "../shapes/types";
import { NumberInput } from "./NumberInput";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

interface Props {
  params: readonly ParamDef[];
  values: ParamValues;
  onChange: (key: string, value: ParamValue) => void;
}

/** Renders controls for any shape's parameter list. */
export function ParamControls({ params, values, onChange }: Props) {
  return (
    <FieldGroup>
      {params
        .filter(p => p.visible?.(values) ?? true)
        .map(p => {
          const change = (v: ParamValue) => onChange(p.key, v);
          switch (p.kind) {
            case "number":
              return <NumberControl key={p.key} param={p} values={values} onChange={change} />;
            case "toggle":
              return <ToggleControl key={p.key} param={p} value={Boolean(values[p.key])} onChange={change} />;
            case "select":
              return <SelectControl key={p.key} param={p} values={values} onChange={change} />;
          }
        })}
    </FieldGroup>
  );
}

function NumberControl({
  param,
  values,
  onChange,
}: {
  param: NumberParam;
  values: ParamValues;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const value = Number(values[param.key]);
  const { min, max, step } = resolveRange(param, values);
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  const marks = resolveMarks(param, values);
  const span = max - min;
  // Dragging near a notch lands on it; the steppers and number box stay exact.
  const snap = (v: number) => marks.find(m => Math.abs(m.value - v) <= Math.max(step, span / 72))?.value ?? v;

  return (
    <Field>
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel htmlFor={id}>{param.label}</FieldLabel>
        <span className="font-mono text-[11px] text-muted-foreground">
          {min}–{max}
          {param.unit ? ` ${param.unit}` : ""}
        </span>
      </div>
      <div className={cn("flex items-center gap-1.5", marks.length > 0 && "pb-4")}>
        <Button size="icon" aria-label={`Decrease ${param.label}`} onClick={() => set(value - step)}>
          <MinusIcon />
        </Button>
        <div className="relative flex min-w-0 grow">
          <Slider
            min={min}
            max={max}
            step={step}
            value={value}
            aria-label={param.label}
            onValueChange={v => set(snap(v as number))}
          />
          {marks.map(m => (
            <button
              key={m.value}
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={() => set(m.value)}
              className="absolute top-full flex -translate-x-1/2 cursor-pointer flex-col items-center gap-0.5 p-0 text-muted-foreground hover:text-foreground"
              // Offsets by half the 16px thumb so a notch sits under the thumb's centre.
              style={{ left: `calc(8px + (100% - 16px) * ${span ? (m.value - min) / span : 0})` }}
            >
              <span className={cn("h-[5px] w-0.5 bg-current", m.value === value && "bg-grass")} />
              {m.label && <span className="font-mono text-[9px] leading-none">{m.label}</span>}
            </button>
          ))}
        </div>
        <Button size="icon" aria-label={`Increase ${param.label}`} onClick={() => set(value + step)}>
          <PlusIcon />
        </Button>
        <NumberInput id={id} variant="readout" min={min} max={max} step={step} value={value} onChange={set} />
      </div>
      <Hint param={param} values={values} />
    </Field>
  );
}

function Hint({ param, values }: { param: ParamDef; values: ParamValues }) {
  const hint = resolveHint(param, values);
  return hint ? <FieldDescription>{hint}</FieldDescription> : null;
}

function ToggleControl({ param, value, onChange }: { param: ToggleParam; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Field orientation="horizontal">
      <FieldLabel className="w-full cursor-pointer justify-between">
        {param.label}
        <Switch checked={value} onCheckedChange={onChange} />
      </FieldLabel>
    </Field>
  );
}

function SelectControl({
  param,
  values,
  onChange,
}: {
  param: SelectParam;
  values: ParamValues;
  onChange: (v: string) => void;
}) {
  const id = useId();
  const value = String(values[param.key]);
  return (
    <Field>
      <FieldLabel id={id}>{param.label}</FieldLabel>
      {param.dropdown ? (
        <Select items={param.options} value={value} onValueChange={v => v && onChange(v)}>
          <SelectTrigger aria-labelledby={id}>
            <SelectValue>{(v: string) => <OptionLabel option={param.options.find(o => o.value === v)} />}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {param.options.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  <OptionLabel option={o} />
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : (
        <ToggleGroup
          aria-labelledby={id}
          variant="segment"
          spacing={1}
          className="w-full flex-wrap rounded-[4px] bg-sky-deep p-[3px]"
          value={[value]}
          onValueChange={v => v[0] && onChange(v[0])}
        >
          {param.options.map(o => (
            <ToggleGroupItem key={o.value} value={o.value}>
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <Hint param={param} values={values} />
    </Field>
  );
}

function OptionLabel({ option }: { option?: SelectParam["options"][number] }) {
  if (!option) return null;
  return (
    <span className="flex items-center gap-2">
      {option.icon && <img src={option.icon} alt="" className="size-4 [image-rendering:pixelated]" />}
      {option.label}
    </span>
  );
}
