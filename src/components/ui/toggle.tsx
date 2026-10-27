import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "group/toggle inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 border-2 font-sans font-extrabold whitespace-nowrap select-none disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // A pressed chip lights up diamond-blue.
        default:
          "rounded-sm border-input bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground hover:bg-accent data-pressed:border-ring data-pressed:text-diamond",
        chip:
          "rounded-sm border-input bg-secondary px-3 py-1.5 text-[13px] text-secondary-foreground hover:bg-accent data-pressed:border-ring data-pressed:text-diamond",
        // One option of a grass-green segmented picker.
        segment:
          "grow rounded-sm border-0 bg-transparent px-2.5 py-1.5 text-[13px] text-secondary-foreground hover:bg-accent data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:shadow-[inset_0_-3px_0_var(--grass-dark)] data-pressed:hover:bg-primary",
        tool:
          "h-[38px] rounded-[4px] border-input bg-secondary px-2.5 text-xs text-secondary-foreground hover:bg-accent data-pressed:border-gold data-pressed:bg-accent data-pressed:text-gold",
        card:
          "flex-col justify-start gap-1.5 rounded-[4px] border-input bg-secondary px-1.5 py-2.5 whitespace-normal text-secondary-foreground shadow-block-sm transition-[transform,background-color,border-color] duration-[120ms] hover:-translate-y-0.5 hover:border-muted-foreground hover:bg-accent active:translate-y-px data-pressed:border-gold data-pressed:bg-accent data-pressed:text-foreground data-pressed:hover:border-gold",
        // A painted block; the face colours come from inline style.
        swatch:
          "size-[34px] rounded-[2px] border-[3px] border-shadow p-0 transition-transform duration-[120ms] hover:-translate-y-0.5 hover:-rotate-4 data-pressed:-translate-y-[3px] data-pressed:rotate-0 data-pressed:border-gold data-pressed:outline-2 data-pressed:outline-shadow",
      },
      size: {
        default: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
