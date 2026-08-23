"use client";

import { useRef, type ChangeEvent } from "react";
import { Camera, FileText, Image as ImageIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MobileFilePickerProps {
    onFilesSelected: (files: File[]) => void;
    accept?: string;
    multiple?: boolean;
    disabled?: boolean;
    label?: string;
    className?: string;
}

export function MobileFilePicker({
    onFilesSelected,
    accept = "image/*,application/pdf",
    multiple = true,
    disabled = false,
    label = "Select Files",
    className,
}: MobileFilePickerProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const photosInputRef = useRef<HTMLInputElement>(null);

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            onFilesSelected(Array.from(event.target.files));
            event.target.value = "";
        }
    };

    const isImageOnly = accept.includes("image") && !accept.includes("pdf");
    const isPdfOnly = accept.includes("pdf") && !accept.includes("image");

    return (
        <div className={cn("w-full space-y-2", className)}>
            {/* Hidden native inputs for mobile device integration */}
            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                multiple={multiple}
                disabled={disabled}
                className="hidden"
                onChange={handleInputChange}
            />

            {/* Camera input with capture attribute for mobile devices */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                disabled={disabled}
                className="hidden"
                onChange={handleInputChange}
            />

            {/* Photos library input */}
            <input
                ref={photosInputRef}
                type="file"
                accept="image/*"
                multiple={multiple}
                disabled={disabled}
                className="hidden"
                onChange={handleInputChange}
            />

            {/* Touch-optimized mobile action buttons */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                {!isPdfOnly && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() => cameraInputRef.current?.click()}
                        className="h-9 gap-1.5 text-xs shadow-2xs sm:flex-1"
                    >
                        <Camera className="size-3.5 text-primary" />
                        <span>Camera</span>
                    </Button>
                )}

                {!isPdfOnly && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() => photosInputRef.current?.click()}
                        className="h-9 gap-1.5 text-xs shadow-2xs sm:flex-1"
                    >
                        <ImageIcon className="size-3.5 text-blue-500" />
                        <span>Photos</span>
                    </Button>
                )}

                {!isImageOnly && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            "h-9 gap-1.5 text-xs shadow-2xs sm:flex-1",
                            isPdfOnly ? "col-span-2 w-full" : "col-span-2 sm:col-span-1",
                        )}
                    >
                        <FileText className="size-3.5 text-emerald-500" />
                        <span>Browse Files</span>
                    </Button>
                )}
            </div>
        </div>
    );
}
