/**
 * V3 prompts — PATH-BASED two-stage extraction.
 *
 * Every prompt here is kept in PERFECT sync with ./new-schema:
 *  - `structuredTextExtractionPromptV3` <-> `pageSchema` / `partialOCRJsonSchema`
 *  - `buildStage2BoundingBoxPrompt`    <-> `stage2RootSchema` / `stage2BoundingBoxRootJsonSchema`
 *
 * Stage 1 emits NO coordinates. Figure localization is stage 2's job,
 * driven by the hasFigure flags stage 1 reports.
 */

export type Stage2Target = {
  path: string[] | null;
  needs: {
    question: boolean;
    solution: boolean;
    options: Array<"A" | "B" | "C" | "D">;
  };
};

/** Verbatim display of a target's path ("4", "4(ii)"), or "(unlabeled)". */
function displayPath(path: string[] | null): string {
  if (!path || path.length === 0) return "(unlabeled continuation entity)";
  return path.join(" \u203a ");
}

/**
 * STAGE 1 — text / LaTeX extraction + hasFigure detection.
 * Identity is the PATH: the chain of printed labels, verbatim.
 */
export const structuredTextExtractionPromptV3 = `You are an expert OCR and exam parsing engine.
Extract every question, solution, option, passage, and answer from the provided page image.

---
## Input Context
You will receive a single page image from a multi-page examination or study document.
Pages can contain: questions with options, step-by-step solutions, reading passages, answer-key tables, section headers.
Subjects: math, physics, chemistry, grammar, comprehension.

---
## PATH identity system (CRITICAL — read carefully)

Every entity you emit is identified by \`path\`: the chain of printed labels from the TOP of the document hierarchy down to that entity, with each label VERBATIM as printed on the page.

- Parent question 4 with sub-question (ii)  ->  "path": ["4", "ii"]
- Plain question 12                          ->  "path": ["12"]
- Sub-sub-question (b) of question 7(i)      ->  "path": ["7", "i", "b"]
- Roman/alpha/numeric labels keep their printed form: ["2", "iv"], ["9", "b"], ["15", "3"].

PATH RULES:
1. Copy labels EXACTLY as printed, including case: "(ii)" -> "ii", "Q.7." -> "7", "b)" -> "b".
2. If an entity's printed label chain is partially visible (e.g. only "(ii)" shows, its parent "4" was printed on an earlier page), emit the VISIBLE suffix only. NEVER invent invisible ancestor labels — the downstream stitcher reconstructs the full chain from context.
3. If an entity has NO printed label visible at all (a clear continuation of content from the previous page), OMIT "path" entirely (the schema allows null). Do not guess.
4. Two different entities on one page must not end up with the same full path. If the page restarts numbering under a new section, rely on the sections field to disambiguate — paths stay relative to the printed labels.
5. A directive/stem line belongs to the PARENT entity ("4. Answer the following:" is the entity with path ["4"]); each sub-question is its own entity with path ["4","i"], ["4","ii"], ...

---
## Entity kinds (exactly one per entity)

1. PASSAGE entity — contains a reading passage: { "passage": { "text" } }. Never duplicate the passage inside a question entity. If several questions follow one passage, the passage is emitted ONCE; the questions are separate entities. Passage continuation across page boundaries is signaled by page-level "isStartOpen"/"isEndOpen" — do NOT set passage-level flags.
2. QUESTION entity — { "question", "solution"?, "options"?, "answerKey"? }. An entity may hold only a question, only a solution, question+options, an answer key row, or any sensible combination that the page prints together. The standalone printed answer value goes inside "solution.answerValue".
3. ANSWER-ROW entity — an answer-key table row or standalone printed answer: { "path": <the question's printed label chain>, "answerKey": "A"|"B"|"C"|"D" and/or "solution": { "answerValue": <string|number> } }. The path must be the label chain the answer refers to, exactly as printed (e.g. ["4","ii"]). Do not set question/options on an answer row.

If an entity is none of these and is not extractable, do not emit it.
- If ALL of an entity's fields are null/empty (no passage text, no question text, no solution text, no options, no answerKey, no answerValue), DO NOT emit that entity at all. An empty/null entity is worse than no entity — omit it entirely.

---
## Output JSON shape & null policy (CRITICAL)

One JSON object. Root keys: "pageNo", "isRelevant", "isStartOpen", "isEndOpen", "sections", "entities".

- "pageNo": integer page number, or null when not needed.
- "isRelevant": false ONLY for blank/instruction-only/header-only pages; then "entities" is null or [].
- "isStartOpen": true when this page opens MID-entity — the first visible content continues an entity that started on the previous page (sentence/constraint begins abruptly, or content clearly spills from before). false when the page starts with a fresh entity.
- "isEndOpen": true when the page ends MID-entity — the last entity's content continues onto the next page (text stops mid-sentence, options or solution visibly incomplete). false when the last line completes the entity.
- "sections": array of the page's section declarations [{ "label", "start"?, "end"?, "eachMarks"? }]; null when the page declares none. Recognize "1x60=60" as start 1, end 60, eachMarks 1. Copy label text verbatim.
- "entities": array of entity objects (null/[] when page irrelevant).

ENTITY object keys (emit ALL of them, null when not applicable):
"path", "passage", "question", "solution", "options", "answerKey".

- "question"/"solution": { "text", "hasFigure", "marks"?, "difficulty"?, "subject"?, "isStandalone"?, "answerValue"? }
  - "text": verbatim content INCLUDING math/LaTeX; empty string "" ONLY when the block is purely a figure.
  - "hasFigure": true when the block contains a diagram, figure, graph, circuit, illustration, or a drawn/annotated table that is part of ITS content.
  - "isStandalone": true when this question/subquestion can be represented as a standalone question WITHOUT any data from the parent question directive or any content from other pages. false when it needs the parent stem joined (typical subquestions). Continuation / cut-off handling is NOT this flag's job — pages report isStartOpen/isEndOpen.
  - "answerValue": standalone printed answer value (subjective / numeric). Carried by the solution block. This is the FINAL VALUE of the worked solution — use it to cross-check whether the selected option is correct. Only include when the solution derives an actual value and you are 100% confirmed it is correct (typical for physics and mathematics). Do NOT include for explanation-type answers where no single value can be derived. Do NOT guess.
  - "marks"/"difficulty"/"subject": null when not printed or not inferable. Do NOT guess difficulty.
- "options": { "A", "B", "C", "D" } each option is { "text", "hasFigure" } or null when the option does not exist. An option that is only a diagram has "text": null, "hasFigure": true. NEVER emit {"text": null, "hasFigure": false}.
- answer rows set "answerKey" and/or "solution.answerValue"; everything else null.
- NEVER include bounding boxes or coordinates in this stage. Booleans and text only.

STRICT SHAPE RULES:
- Include EVERY listed key on every object you emit; use null for not-applicable. Never omit a key, never emit the string "null".
- Do NOT output duplicate entities for the same path; merge content that the page prints together.
- Only extract what is on the page. Do not solve questions.

---
## Reading order & boundaries (CRITICAL)

- Entrance papers are usually in 2+ vertical columns: read the LEFT column top-to-bottom FIRST, then the right, in document reading order.
- Transcribe page-cut-off content exactly as printed — never complete a fragment and never reach into the next page. Signal continuation/cut-off at the PAGE level via "isStartOpen"/"isEndOpen" instead of entity-level flags.
- The char straddling a page edge belongs to one side only.
- Subject classification when determinable: "math" (NOT "maths"), "physics", "chemistry", "grammar", "comprehension" for English non-grammar questions. null when not inferable.

---
## Content formatting

The extracted content renders via ReactMarkdown + remark-math + KaTeX + mhchem.
1. Inline math in $...$, standalone equations in $$...$$ (opening/closing delimiters each on their own line). Delimiters MUST match. Never leave LaTeX commands bare outside delimiters ($\\alpha$, $\\theta$, $x^{10}$). Units inside math use \\text{...}, e.g. $v = 20\\text{ m/s}$.
2. Braces balance; multi-character exponents/indices go in braces ($10^{-3}$, $x^{10}$, never $10^-3$).
3. Chemistry via mhchem: $\\ce{H2O}$, $\\ce{SO4^{2-}}$, $\\ce{2H2 + O2 -> 2H2O}$. Never double-subscript inside \\ce. Arrows ASCII -> / <=> (never the Unicode arrow character).
4. ASCII normalization: \u2212 (U+2212) -> "-", \u00d7 -> \\times, ^2 superscript preserved as ^2, \u00b0 -> \\circ, \u2264 -> \\leq, \u00b1 -> \\pm. Straight quotes only.
5. JSON: every LaTeX backslash DOUBLED inside JSON strings.
6. No placeholder text: never write "[see figure]" or "as shown in the diagram" unless such words are literally printed. Transcribe only printed words.

---
## JSON OUTPUT EXAMPLES

### Example 1 — hierarchical sub-questions with a stem, MCQ options, no figures
\`\`\`json
{
  "pageNo": 7,
  "isRelevant": true,
  "isStartOpen": false,
  "isEndOpen": false,
  "sections": null,
  "entities": [
    {
      "path": ["4"],
      "passage": null,
      "question": {
        "text": "4. Answer the following in one word:",
        "hasFigure": false,
        "marks": 2,
        "difficulty": null,
        "subject": "grammar",
        "isStandalone": true
      },
      "solution": null,
      "options": null,
      "answerKey": null
    },
    {
      "path": ["4", "i"],
      "passage": null,
      "question": {
        "text": "(i) The plural of \\"child\\" is ____.",
        "hasFigure": false,
        "marks": null,
        "difficulty": null,
        "subject": null,
        "isStandalone": false
      },
      "solution": {
        "text": null,
        "hasFigure": false,
        "answerValue": "children"
      },
      "options": null,
      "answerKey": null
    },
    {
      "path": ["5"],
      "passage": null,
      "question": {
        "text": "A body of mass $m$ is thrown vertically upward with velocity $v$. The maximum height is:",
        "hasFigure": false,
        "marks": 1,
        "difficulty": null,
        "subject": "physics",
        "isStandalone": true
      },
      "solution": {
        "text": "Using $v^2 = u^2 - 2gh$ with $v = 0$: $$h = \\\\frac{v^2}{2g}$$",
        "hasFigure": false,
        "marks": null,
        "difficulty": null,
        "subject": null,
        "isStandalone": true
      },
      "options": {
        "A": { "text": "$\\\\dfrac{v^2}{2g}$", "hasFigure": false },
        "B": { "text": "$\\\\dfrac{v^2}{4g}$", "hasFigure": false },
        "C": { "text": "$\\\\dfrac{v^2}{8g}$", "hasFigure": false },
        "D": { "text": "$\\\\dfrac{3v^2}{4g}$", "hasFigure": false }
      },
      "answerKey": "B"
    }
  ]
}
\`\`\`

### Example 2 — page opens mid-solution AND ends mid-question; figure-bearing entity; answer-key rows
\`\`\`json
{
  "pageNo": 8,
  "isRelevant": true,
  "isStartOpen": true,
  "isEndOpen": true,
  "sections": [{ "label": "Section B", "start": "4", "end": "20", "eachMarks": 2 }],
  "entities": [
    {
      "path": ["3"],
      "passage": null,
      "question": null,
      "solution": {
        "text": "...therefore $\\\\omega = \\\\sqrt{k/m}$, giving the angular frequency.",
        "hasFigure": false,
        "marks": null,
        "difficulty": null,
        "subject": "physics",
        "isStandalone": false
      },
      "options": null,
      "answerKey": null
    },
    {
      "path": ["4", "ii"],
      "passage": null,
      "question": {
        "text": "",
        "hasFigure": true,
        "marks": 2,
        "difficulty": null,
        "subject": null,
        "isStandalone": true
      },
      "solution": null,
      "options": null,
      "answerKey": null
    },
    {
      "path": ["6"],
      "passage": null,
      "question": null,
      "solution": {
        "text": null,
        "hasFigure": false,
        "answerValue": null
      },
      "options": null,
      "answerKey": "A"
    }
  ]
}
\`\`\`
(The last entity is an answer-key row for question 6; the figure question's text is empty because the block is purely a diagram.)

### Example 3 — reading passage page
\`\`\`json
{
  "pageNo": 12,
  "isRelevant": true,
  "isStartOpen": false,
  "isEndOpen": true,
  "sections": null,
  "entities": [
    {
      "path": null,
      "passage": {
        "text": "Climate change poses unprecedented challenges to global agricultural productivity. As temperatures rise and precipitation patterns become erratic, staple crops such as wheat and rice experience declining yields.",
      },
      "question": null,
      "solution": null,
      "options": null,
      "answerKey": null
    },
    {
      "path": ["15"],
      "passage": null,
      "question": {
        "text": "According to the passage, what is the primary threat to staple crop yields?",
        "hasFigure": false,
        "marks": null,
        "difficulty": null,
        "subject": "comprehension",
        "isStandalone": true
      },
      "solution": null,
      "options": {
        "A": { "text": "Excessive fertilizer usage", "hasFigure": false },
        "B": { "text": "Rising temperatures and erratic precipitation", "hasFigure": false },
        "C": { "text": "Overpopulation in rural areas", "hasFigure": false },
        "D": { "text": "Pest infestations", "hasFigure": false }
      },
      "answerKey": null
    }
  ]
}
\`\`\`
(The passage entity has no printed label, so "path" is null.)`;

/**
 * STAGE 2 — dynamic bounding-box extraction.
 *
 * Built from stage 1: the model is told EXACTLY which entities/parts to
 * locate, and must echo each entity's path character-for-character so the
 * merge can bind boxes back. Coordinates are native Gemini grounding
 * integers on a 0-1000 grid, in perfect sync with the stage-2 schema.
 */
export function buildStage2BoundingBoxPrompt(
  pageNo: number,
  targets: Stage2Target[],
): string {
  const targetLines = targets
    .map((target, index) => {
      const parts: string[] = [];
      if (target.needs.question) parts.push("question");
      if (target.needs.solution) parts.push("solution");
      for (const option of target.needs.options) {
        parts.push(`option ${option}`);
      }
      return `  ${index + 1}. path: ${displayPath(target.path)} — extract ${parts.join(", ")}`;
    })
    .join("\n");

  const hasUnlabeled = targets.some((target) => !target.path);

  return `You are a figure-localization engine. Read the SAME page ${pageNo} image that a previous OCR stage transcribed, and output bounding boxes ONLY for the parts listed below.

## Targets (the ONLY parts you report)
${targetLines}
${hasUnlabeled ? "\nOne target has path null: it is the entity whose content continues from the previous page and had no printed label. Report it with \"path\": null.\n" : ""}
## Output rules (STRICT)
1. Output one JSON object matching this shape:
   { "items": [ { "path": ["4","ii"] | null, "questionFigures": [...], "solutionFigures": [...], "optionFigures": { "A": ..., "B": ..., "C": ..., "D": ... } } ] }
2. One item per listed target. ECHO the target's path EXACTLY, character-for-character (same labels, same form). For the unlabeled target echo null.
3. "questionFigures" / "solutionFigures": ARRAY of one box per separate diagram that belongs to the target's question / solution. Empty array when the part you were told to localize has no diagram ON THIS PAGE (e.g. the diagram sits on the other page of a split entity).
4. "optionFigures": object with keys "A","B","C","D". A key holds ONE box when that option's diagram was requested; null otherwise. Set null for every option you were not told to localize.
5. Never report a box for a part that was not requested for the target. Never report boxes for paths that are not in the list. Never request or invent additional items.
6. If a listed part's diagram is not visible on this page, return an empty array / null for it — do not guess.

## Coordinate system (CRITICAL)
- Output INTEGER coordinates on a 0-1000 grid scaled to the FULL page (origin top-left, x grows right, y grows down). Example: a box covering the whole page is {"xMin":0,"yMin":0,"xMax":1000,"yMax":1000}.
- xMin/yMin/xMax/yMax are integers in [0, 1000] with xMax > xMin and yMax > yMin.
- On two-column pages x is measured across the WHOLE page width: the left column spans roughly x 0..500, the right column 500..1000.
- Box each SEPARATE diagram individually — do not merge distinct figures into one box.
- Tight boxes that include captions/labels belonging to the figure, but exclude neighboring text, option letters, and serial numbers.
- The output drives an automated cropping pipeline — inaccurate boxes cut off figures or crop blank regions. Be precise.`;
}
