import { Card, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  blocks: number;
  solidBlocks: number;
  width: number;
  height: number;
}

const STACK = 64;
const SHULKER = 27 * STACK;

export function describeStacks(blocks: number): string {
  const stacks = Math.floor(blocks / STACK);
  const rest = blocks % STACK;
  if (stacks === 0) return `${rest} loose`;
  return rest ? `${stacks} stack${stacks > 1 ? "s" : ""} + ${rest}` : `${stacks} stack${stacks > 1 ? "s" : ""}`;
}

export function StatsBar({ blocks, solidBlocks, width, height }: Props) {
  const shulkers = blocks / SHULKER;
  const saved = solidBlocks - blocks;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
      <Tile label="Blocks" value={blocks.toLocaleString()} tone="gold" big />
      <Tile label="Stacks of 64" value={describeStacks(blocks)} tone="grass" />
      <Tile label="Footprint" value={`${width} × ${height}`} tone="diamond" />
      {shulkers >= 0.5 ? (
        <Tile label="Shulker boxes" value={`≈ ${shulkers.toFixed(1)}`} tone="amethyst" />
      ) : saved > 0 ? (
        <Tile label="Saved vs solid" value={saved.toLocaleString()} tone="amethyst" />
      ) : null}
    </div>
  );
}

const tones = {
  gold: "text-gold",
  grass: "text-grass",
  diamond: "text-diamond",
  amethyst: "text-amethyst",
} as const;

function Tile({ label, value, tone, big }: { label: string; value: string; tone: keyof typeof tones; big?: boolean }) {
  return (
    <Card size="sm">
      <CardDescription>{label}</CardDescription>
      <span
        className={cn(
          "font-pixel text-[13px] leading-[1.5] tabular-nums",
          tones[tone],
          big && "text-xl leading-[1.5] [text-shadow:3px_3px_0_var(--gold-dark)]",
        )}
      >
        {value}
      </span>
    </Card>
  );
}
