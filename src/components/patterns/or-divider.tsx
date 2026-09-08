import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface OrDividerProps {
  label?: string;
  className?: string;
}

export function OrDivider({ label = "or", className }: OrDividerProps) {
  return (
    <div
      className={cn("flex items-center gap-3 my-1", className)}
      role="separator"
      aria-label={label}
    >
      <Separator className="flex-1 bg-border/80" />
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <Separator className="flex-1 bg-border/80" />
    </div>
  );
}
