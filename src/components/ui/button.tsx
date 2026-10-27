import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-sm border-2 font-sans font-extrabold whitespace-nowrap select-none disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-input bg-secondary text-secondary-foreground hover:bg-accent",
        destructive: "border-input bg-secondary text-destructive hover:bg-accent",
        outline:
          "border-ring bg-transparent text-diamond hover:bg-diamond-dark data-copied:bg-diamond data-copied:text-sky-deep",
        ghost: "border-transparent bg-transparent text-secondary-foreground hover:text-foreground",
        link: "border-0 bg-transparent p-0 font-bold text-muted-foreground underline hover:text-foreground",
      },
      size: {
        default: "px-2.5 py-1.5 text-xs",
        sm: "px-2.5 py-[5px] text-xs",
        lg: "px-3 py-1.5 text-[13px]",
        icon: "size-[26px] p-0 text-foreground active:translate-y-px [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-[22px] p-0 [&_svg:not([class*='size-'])]:size-4",
        inline: "text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
