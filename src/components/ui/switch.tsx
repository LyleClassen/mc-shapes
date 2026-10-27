import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/utils"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group/switch relative inline-flex h-[22px] w-11 shrink-0 cursor-pointer rounded-sm border-2 border-input bg-sky-deep transition-colors duration-150 data-checked:border-grass data-checked:bg-grass-dark data-disabled:cursor-not-allowed data-disabled:opacity-40",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none absolute top-0.5 left-0.5 block size-3.5 bg-secondary-foreground shadow-[inset_-2px_-2px_0_rgba(0,0,0,0.25)] transition-transform duration-150 data-checked:translate-x-[22px] data-checked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
