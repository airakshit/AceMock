"use client";

import { useState, useCallback } from "react";
import { X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiagramViewerProps {
  /** Signed URL for the image. If null/undefined/empty, nothing is rendered. */
  url?: string | null;
  /** Alt text for accessibility */
  alt?: string;
  /** Caption shown below the image (e.g. "Question Diagram", "Solution Working") */
  label?: string;
  className?: string;
}

/**
 * Lazy-loaded image viewer for question diagrams and solution working images.
 *
 * - Renders nothing when `url` is falsy (safe to call unconditionally).
 * - Shows a skeleton placeholder while the image loads.
 * - Click to open a fullscreen lightbox overlay.
 * - Uses Next.js <Image> for optimized loading.
 */
export function DiagramViewer({
  url,
  alt = "Diagram",
  label,
  className,
}: DiagramViewerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const handleLoad = useCallback(() => setIsLoaded(true), []);
  const openLightbox = useCallback(() => setIsLightboxOpen(true), []);
  const closeLightbox = useCallback(() => setIsLightboxOpen(false), []);

  if (!url) return null;

  return (
    <>
      <figure className={cn("space-y-1.5", className)}>
        {label && (
          <figcaption className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </figcaption>
        )}

        <div className="relative group">
          {/* Skeleton while loading */}
          {!isLoaded && (
            <div className="w-full h-48 rounded-lg bg-muted/50 animate-pulse" />
          )}

          {/* The actual image */}
          <div
            className={cn(
              "relative overflow-hidden rounded-lg border bg-background cursor-zoom-in transition-opacity",
              isLoaded ? "opacity-100" : "opacity-0 absolute inset-0",
            )}
            onClick={openLightbox}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openLightbox();
              }
            }}
            aria-label={`Expand ${alt}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={alt}
              onLoad={handleLoad}
              className="w-full max-h-72 object-contain"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
              <ZoomIn className="size-6 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-md" />
            </div>
          </div>
        </div>
      </figure>

      {/* Fullscreen lightbox */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} lightbox`}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Close lightbox"
          >
            <X className="size-5" />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
