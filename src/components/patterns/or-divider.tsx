import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface OrDividerProps {
    label?: string;
    className?: string;
}

export function OrDivider({ label = "or", className }: OrDividerProps) {
    return (
        <div
            className={cn("flex items-center gap-3", className)}
            role="separator"
            aria-label={label}
        >
            <Separator className="flex-1" />
            <span className="shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
                {label}
            </span>
            <Separator className="flex-1" />
        </div>
    );
}
