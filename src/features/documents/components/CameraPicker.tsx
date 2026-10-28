"use client";

import { useRef, type ChangeEvent } from "react";
import { Camera } from "lucide-react";

import { Button } from "@/components/ui/button";

interface CameraPickerProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * CameraPicker — the mobile-only direct camera capture entry point.
 *
 * One button, one job: a hidden `<input type="file" accept="image/*"
 * capture="environment">` opens the phone's rear camera straight away and
 * hands the shot back as a File. Desktop never renders it — the owner
 * decides visibility (the dropzone mounts it inside an `sm:hidden`
 * wrapper, since only phones have cameras).
 */
export function CameraPicker({
  onFilesSelected,
  disabled = false,
  className,
}: CameraPickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onFilesSelected(Array.from(event.target.files));
      event.target.value = "";
    }
  };

  return (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        className="hidden"
        onChange={handleInputChange}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => cameraInputRef.current?.click()}
        className={className}
      >
        <Camera className="size-3.5" />
        Camera
      </Button>
    </>
  );
}
