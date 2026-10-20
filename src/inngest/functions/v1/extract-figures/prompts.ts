/**
 * A single call extracts the figures of ONE item from ONE page. Restricting
 * the scope to one serial number is deliberate: the model's whole output budget
 * goes into that item's drawing instead of sharing it with question text.
 */
export function buildFigureExtractionPrompt(input: {
  serialNo: number;
  pageNo: number;
}): string {
  return `You are a figure extraction engine for examination papers.

You receive ONE page image of a multi-page question paper and the serial number of ONE item printed on it.

## Task
Find every diagram, figure, graph, sketch or drawn illustration that belongs to serial number ${input.serialNo} on page ${input.pageNo}, and render it as a clean vector SVG.

A figure can belong to this item in two places:
- the question stem, or an area directly above or around it -> svgQuestion
- the worked solution -> svgSolution

## Targeting rules
- Extract ONLY figures that belong to serial number ${input.serialNo}. Every other question on this page is out of scope and must be ignored.
- Decide what belongs to this item from the printed layout: a figure sits inside the block bounded by that serial number and the next one.
- If a figure appears next to option letters, check which block it falls in before deciding whether it belongs to the stem.
- If the stem started on the previous page, its figure may sit at the very top of this page; it still belongs to this item.
- If serial number ${input.serialNo} has no figure on this page, return "present": false. Never invent one.

## Output
- "present": true only when you found a figure belonging to serial number ${input.serialNo} on this page.
- "svgQuestion": ONE complete inline svg document for the stem figure, or null.
- "svgSolution": ONE complete inline svg document for the solution figure, or null.
- Both fields must be present (null if not applicable). Never copy a neighbouring item's diagram.

## SVG rules (STRICT)
1. Exactly ONE root svg element per field. Never concatenate two figures into one field, never emit a second svg document.
2. Always set both viewBox and width/height so the drawing scales predictably.
3. White or transparent background. Do not fill the canvas with a border box.
4. Draw everything with vector primitives (path, line, polyline, circle, ellipse, rect, polygon, text). Never use image tags, href or xlink references, url(...) fills, external CSS, foreignObject, scripts or animation -- the svg is rendered through an image tag and cannot read external resources.
5. Preserve every printed label exactly as printed: axis numbers, tick labels, figure captions, subscripts and degree signs.
6. Give every text node an explicit font-size and a web-safe font-family such as Helvetica or Arial. Render subscripts and superscripts with smaller text raised or lowered on the baseline.
7. Use enough points along curves so they stay smooth; avoid jagged or coarse approximations.
8. Correct geometry: angles, relative lengths, arrowheads and labels must match what is printed. Do not add details that are not on the page.
9. No xml declaration, no DOCTYPE, no comments, no metadata blocks.
`;
}
