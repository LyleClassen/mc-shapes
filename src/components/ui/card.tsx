import * as React from "react"
import { cn } from "@/lib/utils"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex min-w-0 flex-col gap-3.5 rounded-md border-[3px] border-border bg-card p-4 text-card-foreground shadow-block",
        "data-[size=sm]:justify-between data-[size=sm]:gap-2 data-[size=sm]:px-3.5 data-[size=sm]:py-3 data-[size=sm]:shadow-[4px_4px_0_var(--shadow)]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex items-center gap-2.5", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="card-title"
      className={cn(
        "m-0 grow font-pixel text-[11px] font-bold leading-[1.4] tracking-[0.04em] text-foreground uppercase",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn(
        "text-xs font-extrabold tracking-[0.03em] text-muted-foreground uppercase",
        className
      )}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("flex shrink-0 items-center", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("flex min-w-0 flex-col gap-3.5", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardAction, CardDescription, CardContent }
