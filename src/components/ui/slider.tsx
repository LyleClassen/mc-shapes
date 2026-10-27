import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "@/lib/utils"

const tones = {
  grass: "[--tone:var(--grass)]",
  diamond: "[--tone:var(--diamond)]",
  redstone: "[--tone:var(--redstone)]",
} as const

/**
 * Drawn like the browser's own dark range input, tinted with `tone`. The
 * thumb is 16px wide and edge-aligned, so ticks can line up under it.
 */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  tone = "grass",
  ...props
}: SliderPrimitive.Root.Props & { tone?: keyof typeof tones }) {
  const _values = Array.isArray(value)
    ? value
    : value !== undefined
      ? [value]
      : Array.isArray(defaultValue)
        ? defaultValue
        : defaultValue !== undefined
          ? [defaultValue]
          : [min]

  return (
    <SliderPrimitive.Root
      className={cn("my-0.5 w-full min-w-0 grow", tones[tone], className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex h-4 w-full cursor-pointer touch-none items-center select-none data-disabled:opacity-40">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative h-2 grow overflow-hidden rounded-full border border-range-edge bg-range-track select-none"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="h-full bg-(--tone) select-none"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="block size-4 shrink-0 rounded-full bg-(--tone) outline-offset-2 select-none has-focus-visible:outline-3 has-focus-visible:outline-gold"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
