"use client";

import { Upload, X } from "lucide-react";
import { useRef, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
    id: string;
    label: string;
    title: string;
    description: string;
    accept: string;
    multiple?: boolean;
    icon: ComponentType<{ className?: string }>;
    value: File[];
    onChange: (files: File[]) => void;
    invalid?: boolean;
    numbered?: boolean;
}

export function FileDropzone({
    id,
    label,
    title,
    description,
    accept,
    multiple = true,
    icon: Icon,
    value,
    onChange,
    invalid,
    numbered,
}: FileDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const idsRef = useRef(new WeakMap<File, string>());

    // Stable, unique id per File instance — needed as a React key since
    // names/sizes can collide across selections.
    const getId = (file: File) => {
        let fid = idsRef.current.get(file);
        if (!fid) {
            fid = crypto.randomUUID();
            idsRef.current.set(file, fid);
        }
        return fid;
    };

    const openPicker = () => inputRef.current?.click();

    const handleFiles = (files: FileList | null) => {
        const newFiles = Array.from(files ?? []);
        if (newFiles.length === 0) return;

        onChange([...value, ...newFiles]);
    };

    const removeFile = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };

    const hiddenInput = (
        <Input
            id={id}
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onClick={(e) => e.stopPropagation()}
            onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = "";
            }}
        />
    );

    // Empty state — full dropzone with text + button.
    if (value.length === 0) {
        return (
            <div
                role="button"
                tabIndex={0}
                onClick={openPicker}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openPicker();
                    }
                }}
                className={cn(
                    "w-full min-w-0 cursor-pointer rounded-lg border border-dashed p-4 transition-colors hover:bg-muted/50",
                    invalid && "border-destructive",
                )}
            >
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                    <div className="rounded-full border p-3">
                        <Icon className="size-5" />
                    </div>

                    <div>
                        <p className="text-sm font-medium">{title}</p>
                        <p className="text-xs text-muted-foreground">
                            {description}
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            openPicker();
                        }}
                    >
                        <Upload className="mr-2 size-4" />
                        Browse {label.toLowerCase()}
                    </Button>
                </div>

                {hiddenInput}
            </div>
        );
    }

    // Collapsed state — compact bar + icon-only "add more" button.
    return (
        <div
            className={cn(
                "w-full min-w-0 space-y-2 rounded-lg border p-3",
                invalid && "border-destructive",
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{label}</p>

                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={openPicker}
                    aria-label={`Add more ${label.toLowerCase()}`}
                    className="shrink-0"
                >
                    <Upload className="size-4" />
                </Button>

                {hiddenInput}
            </div>

            <div className="space-y-2">
                {value.map((file, index) => (
                    <div
                        key={getId(file)}
                        className="flex min-w-0 animate-in items-center gap-2 rounded-md border bg-background p-2 duration-300 fade-in slide-in-from-bottom-2"
                    >
                        {numbered && (
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium">
                                {index + 1}
                            </span>
                        )}

                        <Icon className="size-4 shrink-0 text-muted-foreground" />

                        <span className="min-w-0 flex-1 truncate text-sm">
                            {file.name}
                        </span>

                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => removeFile(index)}
                        >
                            <X className="size-4" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
