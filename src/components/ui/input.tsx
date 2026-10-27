import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const inputVariants = cva(
  "min-w-0 rounded-sm border-2 border-input font-bold disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "w-full bg-secondary px-2 py-1.5 font-sans text-[13px] text-foreground focus:border-ring",
        // The gold read-out box beside a slider.
        readout:
          "w-[58px] shrink-0 bg-sky-deep px-1.5 py-1 text-right font-mono text-sm text-gold focus:border-gold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Input({
  className,
  type,
  variant,
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
