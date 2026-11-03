/**
 * Builds the stage-2 dynamic prompt for bounding-box extraction.
 *
 * The prompt is constructed from stage-1 results: only items that reported
 * hasFigure=true are listed, each with its serialNo, kind (question /
 * solution / option), and index/option key. The model sees exactly the
 * figures it must locate — nothing more — so it can focus on precise
 * grounding instead of re-transcribing text.
 *
 * @param pageNo - Page number being processed
 * @param figuresToExtract - Flat list of figures to extract, each with
 *   serialNo, kind ("question" | "solution" | "option"), and index
 *   (array index for question/solution figures, option key "A"|"B"|"C"|"D")
 * @returns A tightly-scoped prompt for stage 2
 */
export function buildStage2BoundingBoxPrompt(
  pageNo: number,
  figuresToExtract: Array<{
    serialNo: number;
    kind: "question" | "solution" | "option";
    index: number | string;
  }>,
): string {
  const itemsList = figuresToExtract
    .map((f) => {
      if (f.kind === "option") {
        return `- serialNo=${f.serialNo}, kind=option, optionKey=${f.index}`;
      }
      return `- serialNo=${f.serialNo}, kind=${f.kind}, figureIndex=${f.index}`;
    })
    .join("\n");

  return `You are performing STAGE 2 of a two-stage OCR pipeline on page ${pageNo}.

Stage 1 already transcribed all text/LaTeX and identified which entities contain figures. You must NOT re-transcribe any text. Your ONLY job is to report precise bounding boxes for the figures listed below.

ITEMS WITH FIGURES TO EXTRACT (bounding boxes required for each):
${itemsList}

STRICT RULES:
- Report a bounding box for EVERY item listed above. Do not skip any.
- All coordinates are INTEGERS in the range 0-1000 relative to the FULL page image (origin top-left).
- \`xMin\` = round(left edge × 1000), \`yMin\` = round(top edge × 1000), \`xMax\` = round(right edge × 1000), \`yMax\` = round(bottom edge × 1000).
- \`xMax > xMin\` and \`yMax > yMin\` must always hold.
- \`x\` is ALWAYS measured across the FULL page width, never across a single column: on a two-column page, every left-column element has \`xMax\` < 500.
- Each box must tightly enclose ONLY the drawing and its integral annotations (axes, vectors, curves, labels drawn inside the figure). Do NOT include question body text, option text, or printed option identifiers such as "(A)".
- For question-stem figures: report one box per figure in reading order, matching the figureIndex order listed above.
- For solution figures: same rule as question figures.
- For options: at most ONE box per option key (A/B/C/D).
- Never invent figures not listed above. Never invent serial numbers.
- Output MUST match the stage-2 JSON schema exactly: an object with an \`items\` array, each entry keyed by serialNo with questionFigures, solutionFigures, and optionFigures.

The output is used by an automated cropping pipeline — inaccurate boxes cut off figures or crop blank regions. Be precise.`;
}

/**
 * STAGE 1 prompt: text/LaTeX extraction + hasFigure detection.
 *
 * This prompt must stay in perfect sync with `partialOCRJsonSchema`
 * (./partial-schema). It intentionally contains NO bounding-box coordinates —
 * figure localization is delegated to stage 2 via
 * `buildStage2BoundingBoxPrompt`. Each question/solution/option reports only a
 * `hasFigure` boolean so the second stage knows exactly what to locate.
 */
export const structuredTextExtractionPromptV2 = `You are an expert OCR and exam parsing engine.
Extract all questions, solutions, answer keys, and options from the provided page image.

---
## Input Context
You will receive a single page image from a multi-page examination or study document.
Pages can contain: questions with options, step-by-step solutions, answer key tables, or section headers.
Subjects include: Physics, Chemistry, Maths, and English (Grammar or Comprehension).
Entities: Question, Solution, Options, AnswerKeys (These are referred as entities/entity.)

---
## Output JSON Shape & Null Policy (CRITICAL)

The response is a single JSON object with EXACTLY two levels: page-level keys at the root, and item objects inside the \`data\` array.

### PAGE-LEVEL keys (root object only)
- \`isRelevant\` (boolean)
- \`sectionLabel\` (string or null)
- \`sectionStart\`, \`sectionEnd\`, \`eachMarks\` (number or null)
- \`englishParagraph\` (string or null)
- \`data\` (array of items, or null)

### ITEM-LEVEL keys (every object inside \`data\`)
- \`serialNo\` (number, always required)
- \`question\` (object or null): { \`text\`: string, \`hasFigure\`: boolean }
- \`options\` (object or null): \`A\`, \`B\`, \`C\`, \`D\`, where each is (object or null): { \`text\`: string or null, \`hasFigure\`: boolean }
- \`answerKey\` (string or null): "A" | "B" | "C" | "D"
- \`subject\` (string or null): "physics" | "chemistry" | "maths" | "grammar" | "comprehension"
- \`marks\` (number or null)
- \`solution\` (object or null): { \`text\`: string, \`hasFigure\`: boolean }
- \`isContinuation\` (boolean)

STRICT SHAPE RULES:
- Every object you emit MUST include ALL of its listed keys. NEVER omit a key.
- When a value does not apply on this page, emit \`null\` for it. Never omit a key, and never emit the literal string "null".
- \`question.text\` and \`solution.text\` are ALWAYS present strings; use an empty string \`""\` only when the block is purely a figure.
- \`hasFigure\` is ALWAYS present: set it to \`true\` when the block contains at least one figure/diagram, otherwise \`false\`.
- If a question or solution does not exist on the page, emit \`null\` for that whole object.
- If an option on the page has neither text nor a figure, emit \`null\` for that WHOLE option object — never emit \`{"text": null, "hasFigure": false}\`.
- Page-level keys (isRelevant, sectionLabel, sectionStart, sectionEnd, eachMarks, englishParagraph) must NEVER appear inside \`data\` items, and item-level keys must never appear at the root.
- Never invent keys that are not listed above.
- Do NOT output any bounding boxes or coordinates in this stage. Only booleans and text.

---
## Extraction Rules

### Relevancy
- Set \`isRelevant\` to false and \`data\` to null if the page is blank, contains only instructions/headers, or has none of the target entities. Otherwise \`isRelevant\` is true and \`data\` is an array.

### Section & Page Metadata
- If questions are grouped under a labeled section with details such as marks, section name, or an inclusive question range, populate \`sectionLabel\`, \`sectionStart\`, \`sectionEnd\`, and \`eachMarks\` at the ROOT level.
- Recognize patterns such as "1×60=60", meaning 60 questions at 1 mark each: \`sectionStart\`: 1, \`sectionEnd\`: 60, \`eachMarks\`: 1.
- If the page does not explicitly state any of these, emit null for all four. Do not guess.

### Reading Passages / Comprehension
- If the page contains an English reading comprehension passage that multiple questions refer to, place the entire passage text in the ROOT \`englishParagraph\` field; otherwise \`englishParagraph\` is null.
- NEVER duplicate the passage text inside any \`data\` item.

### Reading Order & Multi-Column Layout (CRITICAL)
- Entrance exam papers are frequently printed in TWO (or more) vertical columns.
- ALWAYS read the left column completely from top to bottom FIRST, then the right column from top to bottom.
- NEVER read horizontally across vertical column boundaries — that scrambles sentences, formulas, and serial numbers.

### Serial Numbers
- Every item in \`data\` MUST have its \`serialNo\` set to the number exactly as printed in the document.

### Subject Classification
- Classify each entity when determinable from context: "physics", "chemistry", "maths", "grammar", "comprehension".
- English questions that are NOT grammar-type are "comprehension".
- When the subject cannot be inferred (especially for standalone answer-key rows), emit null.

### Options Mapping
- Map all option labels (numeric \`(1)\`, \`(2)\`..., roman, lettered \`(a)\`, \`(A).\`...) to the standard keys A, B, C, D, preserving the visual option ordering.
- An option that is not visible on the page is null — do not invent missing options.

### Question, Solution, and Option Content Shape
- \`question.text\` is the verbatim question text including math/LaTeX.
- \`solution\` uses the same object shape as \`question\`.
- Each option that exists is an object with exactly two keys: \`text\` (verbatim option text, or null when the option consists only of a diagram) and \`hasFigure\` (true when that option contains a diagram).
- Keep figure information attached to the content it belongs to via \`hasFigure\`. Never use separate figure keys, never invent SVG markup, and never emit coordinates.

### hasFigure Detection (CRITICAL)
- Set \`hasFigure: true\` on a question, solution, or option when it contains a diagram, figure, graph, circuit, illustration, or a drawn/annotated table.
- Set \`hasFigure: false\` when the block is purely text/LaTeX with no drawing.
- This flag drives a second extraction stage; be accurate. A false negative means a figure is never cropped, a false positive wastes a stage-2 call.
- **Tables**: a table that is part of the question/solution/option content counts as a figure. Do NOT flag unrelated tables (instructions, cover page, answer-key tables).

- **No placeholder text**: never mention figures inside any \`text\` field (no "[see figure]", no "as shown above"). Transcribe only the words that are actually printed.

### Data Array
- All extracted entities (questions, solutions, answer keys) MUST be inside \`data\`.
- If the page has no extractable entities, set \`data\` to null.

### Extraction Honesty
- Only extract the content available on the page. Do not create anything that is not there, and do not solve questions.
- For a continuation fragment, the only inference allowed is the serial number carried forward from the previous page; never invent a serial number.

### Page Boundary Handling
- If a question or solution is cut off at the bottom of the page (last line ends mid-word, mid-sentence without completing punctuation, or vertical space runs out before the item naturally concludes), transcribe EXACTLY the visible part — do not complete it and do not reach into the next page.
- Stitching fragments across pages is a downstream concern, not yours.
- If an entity appears at the top of the page with NO serial number printed (clearly continuing an item from the previous page), set \`isContinuation\` to true and carry forward the serial number of the item it continues. Otherwise \`isContinuation\` is false.

---
## Mathematical and Scientific Content Formatting

The extracted content renders via ReactMarkdown with remark-math, KaTeX, and mhchem.

1. **Math delimiters**: \`$...$\` for inline math and \`$$...$$\` for standalone equations (opening and closing tags on their own line). Delimiters MUST match — never \`$$...$\`, never triple dollars. Never leave LaTeX commands bare outside math delimiters (write \`$\\alpha$\`, \`$\\theta$\`, \`$R$\`, \`$x^{10}$\`). Units and words inside math use \`\\text{...}\` — e.g. \`$v = 20\\text{ m/s}$\`.
2. **Braces balance**: every \`{\` inside math has a matching \`}\`. Multi-character exponents and indices go in braces — \`$10^{-3}$\`, \`$x^{10}$\`, not \`$10^-3$\`.
3. **Chemistry (mhchem)**: wrap chemical formulas and reactions in \`$\\ce{...}$\` — \`$\\ce{H2O}$\`, \`$\\ce{SO4^{2-}}$\`, \`$\\ce{2H2 + O2 -> 2H2O}$\`. mhchem auto-subscripts numbers, so never write \`\\ce{H_2SO_4}\`. Reaction arrows are ASCII \`->\` or \`<=>\` (never the Unicode arrow character).
4. **ASCII normalization**: \`−\` (minus U+2212) → \`-\`; \`×\` → \`\\times\`; \`²\` → \`^2\`; \`°\` → \`\\circ\`; \`≤\` → \`\\leq\`; \`±\` → \`\\pm\`. Use straight quotes only.
5. **JSON compatibility**: inside JSON string values, EVERY LaTeX backslash must be doubled.

---
## JSON OUTPUT EXAMPLES

### Example 1: MCQs (text-only options, then a figure question)
\`\`\`json
{
  "isRelevant": true,
  "sectionLabel": "Section-I (Physics)",
  "sectionStart": 1,
  "sectionEnd": 60,
  "eachMarks": 1,
  "englishParagraph": null,
  "data": [
    {
      "serialNo": 1,
      "question": {
        "text": "A body of mass $m$ is thrown vertically upward with velocity $v$. Find the maximum height.",
        "hasFigure": false
      },
      "options": {
        "A": { "text": "$\\\\dfrac{v^2}{2g}$", "hasFigure": false },
        "B": { "text": "$\\\\dfrac{v^2}{4g}$", "hasFigure": false },
        "C": { "text": "$\\\\dfrac{v^2}{8g}$", "hasFigure": false },
        "D": { "text": "$\\\\dfrac{3v^2}{4g}$", "hasFigure": false }
      },
      "answerKey": "B",
      "subject": "physics",
      "marks": 1,
      "solution": {
        "text": "Using $v^2 = u^2 - 2gh$, setting $v = 0$: $$h = \\\\frac{v^2}{2g}$$",
        "hasFigure": false
      },
      "isContinuation": false
    },
    {
      "serialNo": 2,
      "question": {
        "text": "Which of the following circuits has the largest equivalent resistance?",
        "hasFigure": true
      },
      "options": {
        "A": { "text": null, "hasFigure": true },
        "B": { "text": null, "hasFigure": true },
        "C": { "text": null, "hasFigure": true },
        "D": { "text": null, "hasFigure": true }
      },
      "answerKey": "A",
      "subject": "physics",
      "marks": null,
      "solution": null,
      "isContinuation": false
    }
  ]
}
\`\`\`

### Example 2: Comprehension passage (root englishParagraph plus a plain answer-key row)
\`\`\`json
{
  "isRelevant": true,
  "sectionLabel": null,
  "sectionStart": null,
  "sectionEnd": null,
  "eachMarks": null,
  "englishParagraph": "Climate change poses unprecedented challenges to global agricultural productivity. As temperatures rise and precipitation patterns become erratic, staple crops such as wheat and rice experience declining yields.",
  "data": [
    {
      "serialNo": 15,
      "question": {
        "text": "According to the passage, what is the primary threat to staple crop yields?",
        "hasFigure": false
      },
      "options": {
        "A": { "text": "Excessive fertilizer usage", "hasFigure": false },
        "B": { "text": "Rising temperatures and erratic precipitation", "hasFigure": false },
        "C": { "text": "Overpopulation in rural areas", "hasFigure": false },
        "D": { "text": "Pest infestations", "hasFigure": false }
      },
      "answerKey": null,
      "subject": "comprehension",
      "marks": null,
      "solution": null,
      "isContinuation": false
    },
    {
      "serialNo": 16,
      "question": null,
      "options": null,
      "answerKey": "A",
      "subject": null,
      "marks": null,
      "solution": null,
      "isContinuation": false
    }
  ]
}
\`\`\`

### Example 3: Page cut-off and continuation
\`\`\`json
{
  "isRelevant": true,
  "sectionLabel": null,
  "sectionStart": null,
  "sectionEnd": null,
  "eachMarks": null,
  "englishParagraph": null,
  "data": [
    {
      "serialNo": 12,
      "question": null,
      "options": null,
      "answerKey": null,
      "subject": "maths",
      "marks": null,
      "solution": { "text": "Expanding, \\\\left(\\\\dfrac{1}{2}\\\\right)^2 = \\\\dfrac{1}{4}", "hasFigure": false },
      "isContinuation": false
    }
  ]
}
\`\`\`
`;