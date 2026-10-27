import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const accents = {
  grass: "bg-grass",
  gold: "bg-gold",
  diamond: "bg-diamond",
  amethyst: "bg-amethyst",
  redstone: "bg-redstone",
} as const;

interface Props {
  title: string;
  accent?: keyof typeof accents;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, accent = "grass", action, children, className }: Props) {
  return (
    <Card className={className}>
      <CardHeader>
        <span className={cn("size-3 shrink-0 shadow-bevel", accents[accent])} />
        <CardTitle>{title}</CardTitle>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
