/**
 * Pure bounding-box → pixel geometry for figure crops.
 *
 * Kept dependency-free so tests, debugging tools, and the extraction
 * pipeline share the exact same crop math without importing storage/sharp
 * side effects.
 */

/** Padding applied around each figure crop, as a fraction of the page dimension. */
export const FIGURE_CROP_PADDING_FRACTION = 0.01;

export interface CropRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Converts a normalized bounding box into sharp.extract() pixel geometry:
 * coordinates are defensively clamped into [0, 1] (models occasionally emit
 * values just outside the page despite schema bounds) and each edge is padded
 * by a small fraction of the page so tight or edge-hugging boxes do not clip
 * the drawing's strokes. The returned region is always within image bounds.
 */
export function computeCropRegion(
  bbox: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  },
  width: number,
  height: number,
): CropRegion {
  const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
  const xMin = clamp01(bbox.xMin);
  const xMax = clamp01(bbox.xMax);
  const yMin = clamp01(bbox.yMin);
  const yMax = clamp01(bbox.yMax);

  const padX = width * FIGURE_CROP_PADDING_FRACTION;
  const padY = height * FIGURE_CROP_PADDING_FRACTION;

  const left = Math.max(0, Math.round(xMin * width - padX));
  const top = Math.max(0, Math.round(yMin * height - padY));
  const right = Math.min(width, Math.round(xMax * width + padX));
  const bottom = Math.min(height, Math.round(yMax * height + padY));

  return { left, top, width: right - left, height: bottom - top };
}
