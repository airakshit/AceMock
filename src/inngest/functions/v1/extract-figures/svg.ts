const SVG_BLOCK = /<svg[\s\S]*?<\/svg>/i;

/**
 * Collapses model or legacy output down to one clean `<svg>` document.
 *
 * Model responses can be wrapped in declarations, DOCTYPE or explanation text,
 * and the OCR merge joins cross-page fragments with newlines. The diagram
 * column holds a single image reference, so anything outside the first
 * well-formed `<svg>` block is dropped rather than written to storage.
 */
export function firstSvgDocument(
  source: string | null | undefined,
): string | null {
  if (!source) return null;

  const match = source.match(SVG_BLOCK);
  return match ? match[0].trim() : null;
}
