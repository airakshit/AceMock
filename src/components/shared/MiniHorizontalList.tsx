import { LabelIconValueItem } from "../types";

interface MiniHorizontalListProps {
    items: LabelIconValueItem[];
    value?: string;
    onChange: (value: string) => void;
}

export function MiniHorizontalList({
    items,
    value,
    onChange,
}: MiniHorizontalListProps) {
    return (
        <div className="w-full overflow-x-auto scrollbar-none">
            <div className="flex w-max min-w-full gap-2 px-1">
                {items.map(({ label, icon: Icon, value: itemValue }) => {
                    const isSelected = value === itemValue;

                    return (
                        <button
                            key={itemValue}
                            type="button"
                            onClick={() => onChange(itemValue)}
                            className={`
                                flex h-9 shrink-0 items-center gap-2
                                rounded-lg border px-3
                                text-sm font-medium
                                transition-colors
                                active:scale-[0.98]
                                ${
                                    isSelected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                                }
                            `}
                        >
                            <Icon className="size-4 shrink-0" strokeWidth={2} />

                            <span>{label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
