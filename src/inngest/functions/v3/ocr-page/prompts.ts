/**
 * V3 prompts — PATH-BASED two-stage extraction.
 *
 * Every prompt here is kept in PERFECT sync with ./partial-schemas:
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
  /** Plain-text question stem as transcribed in stage 1, when printed. */
  questionText?: string;
  /** Printed text of each REQUESTED option, keyed by option letter. */
  optionTexts?: Partial<Record<"A" | "B" | "C" | "D", string>>;
};

/** Verbatim display of a target's path ("4", "4(ii)"), "(unlabeled)", or the
 *  synthetic page-boundary fragment slots. */
function displayPath(path: string[] | null): string {
  if (!path || path.length === 0) return "(unlabeled continuation entity)";
  if (path.length === 1 && path[0] === "@start") {
    return 'page-top continuation fragment — echo ["@start"]';
  }
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
Subjects: maths, physics, chemistry, grammar, comprehension.

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
3. Every entity carries its printed path. Exception: continuation text at
   the page TOP with no printed label of its own is NOT an entity — it goes
   into "startState.obj" (entity shape minus "path"). Content cut at the
   page BOTTOM IS an entity in "entities" under its printed path (even if
   the text stops mid-sentence); "endState.refPath" then points to that path.
   Do not guess paths.
4. Two different entities on one page must not end up with the same full path. If the page restarts numbering under a new section, rely on the sections field to disambiguate — paths stay relative to the printed labels.
5. A directive/stem line belongs to the PARENT entity ("4. Answer the following:" is the entity with path ["4"]); each sub-question is its own entity with path ["4","i"], ["4","ii"], ...

---
## Entity kinds (exactly one per entity)

1. PASSAGE entity — contains a reading passage: { "passage": { "text", "startQuestionPath", "endQuestionPath" } } where "startQuestionPath"/"endQuestionPath" are the printed label chains of the FIRST and LAST question the passage covers (null when not determinable). Never duplicate the passage inside a question entity. If several questions follow one passage, the passage is emitted ONCE; the questions are separate entities. A passage entity has "path": null (passages carry no printed label of their own). Passage continuation across page boundaries is reported through page-level "startState"/"endState" (a fragment whose "obj" holds { "passage": ... }) — do NOT set passage-level flags.
2. QUESTION entity — { "question", "solution"?, "options"?, "answerKey"? }. An entity may hold only a question, only a solution, question+options, an answer key row, or any sensible combination that the page prints together. The standalone printed answer value goes inside "solution.answerValue".
3. ANSWER-ROW entity — an answer-key table row or standalone printed answer: { "path": <the question's printed label chain>, "answerKey": "A"|"B"|"C"|"D" and/or "solution": { "answerValue": <string|number> } }. The path must be the label chain the answer refers to, exactly as printed (e.g. ["4","ii"]). Do not set question/options on an answer row.

If an entity is none of these and is not extractable, do not emit it.
- If ALL of an entity's fields are null/empty (no passage text, no question text, no solution text, no options, no answerKey, no answerValue), DO NOT emit that entity at all. An empty/null entity is worse than no entity — omit it entirely.

---
## PAGE BOUNDARIES — startState / endState (CRITICAL)

A page edge can cut ONE entity in half. The piece printed on THIS page is reported in the page-level state object; it must NOT also appear in "entities". "entities" holds only content whose extraction is fully contained in this page.

Both "startState" and "endState" are ALWAYS emitted, each with exactly two keys:
- "startState" - the page TOP. Exactly ONE of the two fields is populated:
  * Fresh start: { "refPath": <first entity's printed path>, "obj": null } - the first entity's label chain echoed here; that same entity also appears in "entities".
  * Continuation: { "refPath": null, "obj": <fragment> } - the page starts mid-entity; the visible continuation text lives in "obj" (entity shape minus "path") and belongs to the item the previous page ended on. The fragment's label is NOT re-printed here, so refPath is null.
  Both fields populated, or both null, is a contract violation.

- "endState" - the page BOTTOM: { "refPath": <last entity's printed path> } - the printed path of the page's last entity, VERBATIM (same PATH rules), whether that entity is complete or cut mid-way. Never null in the contract. No "obj": the bottom entity's content is in "entities", not here. This pointer tells the stitcher which item the next page's "startState" may continue.
- At most ONE entity is cut per boundary. If the page bottom ends inside question 30, question 30 is an entity in "entities" (its visible head) with "endState.refPath" ["30"]; question 31, which starts and completes afterwards, is a separate entity in "entities". The continuation of 30's text appears on the next page's "startState.obj".
- Diagrams inside a startState fragment: mark "hasFigure" inside the fragment's question/solution/options blocks exactly as for entities - stage 2 localizes them under the fragment's key.
- A passage cut in half: its visible part on this page is a passage entity in "entities"; its continuation on the next page travels as a passage fragment in that page's "startState.obj".

---
## Output JSON shape & null policy (CRITICAL)

One JSON object. Root keys: "pageNo", "isRelevant", "startState", "endState", "sections", "entities".

- "pageNo": integer page number, or null when not needed.
- "isRelevant": false ONLY for blank/instruction-only/header-only pages; then "entities" is null or [].
- "startState"/"endState": always emitted, per the contract above - "startState" is { "refPath", "obj": null } on a fresh start or { "refPath": null, "obj": <fragment> } on a continuation; "endState" is { "refPath": <last entity's path> }. The fragment must NOT also appear in entities.
- "sections": array of section-header declarations printed on THIS page (see the "## SECTIONS" block below for the full field contract), or null when the page declares none.
- "entities": array of entity objects 

ENTITY object keys (emit ALL of them, null when not applicable):
"path", "passage", "question", "solution", "options", "answerKey".

Every downstream subquestion will be treated as a single question entity with its own options, 
solutions and all. So mark isStandalone: false when any subquestion cannot be represented as standalone
question.

- "question"/"solution": { "text", "hasFigure", "marks", "subject", "isStandalone" } — the "solution" block additionally carries "answerValue". No difficulty is extracted anywhere.
  - "text": verbatim content INCLUDING math/LaTeX; empty string "" ONLY when the block is purely a figure.
  - "hasFigure": true when the block contains a diagram, figure, graph, circuit, illustration, or a drawn/annotated table that is part of ITS content.
  - "isStandalone": ALWAYS emit a real boolean (true/false, NEVER null) for every question and solution block. True when this question/subquestion can be represented as a standalone question WITHOUT any data from the parent question directive or any content from other pages. False when it needs the parent stem joined (typical subquestions) or for answer-row solutions. Continuation / cut-off handling is NOT this flag's job — pages report startState/endState.
  - "answerValue": standalone printed answer value (subjective / numeric). Carried by the solution block. This is the FINAL VALUE of the worked solution — use it to cross-check whether the selected option is correct. Only include when the solution derives an actual value and you are 100% confirmed it is correct (typical for physics and mathematics). Do NOT include for explanation-type answers where no single value can be derived. Do NOT guess.
  - "marks"/"subject": null when not printed or not inferable.
- "options": { "A", "B", "C", "D" } each option is { "text", "hasFigure" } or null when the option does not exist. An option that is only a diagram has "text": null, "hasFigure": true. NEVER emit {"text": null, "hasFigure": false}.
- answer rows set "answerKey" and/or "solution.answerValue"; everything else null.
- NEVER include bounding boxes or coordinates in this stage. Booleans and text only.

STRICT SHAPE RULES:
- Include EVERY listed key on every object you emit; use null for not-applicable. Never omit a key, never emit the string "null".
- Do NOT output duplicate entities for the same path; merge content that the page prints together.
- Only extract what is on the page. Do not solve questions.
- PATH matching for solutions: a solution block, hint block, or answer block that re-prints (or clearly refers to) a question's label MUST use that QUESTION's own printed path chain VERBATIM — e.g. a solution for question 12 has "path": ["12"], NOT ["Sol.12"], ["Solution 12"], ["H&W12"] or any decorated variant. The same applies inside a "Solutions"/"Hints & Solutions" section: each entry keeps the exact path of the question it answers. Wrong paths silently detach solutions from their questions downstream.

---
## SECTIONS — header/range declarations

A "section" is any printed group header or range annotation on this page, such as:
"Section B", "Section B (Q.4 to Q.20) — 2 marks each", "Attempt any 10 questions",
"Section A: 1x60=60", "Answer all questions. 5x8=40".

Emit ONE object per section annotation printed on THIS page, in printed order; null when the page has none. Every section object has EXACTLY these five keys:

- "label" (string, ALWAYS filled): the section's printed heading text, VERBATIM (e.g. "Section B"). For a bare numeric annotation with no heading ("1x60=60"), use the printed text itself as the label (e.g. "1x60=60").

- "startPath" (array of strings, or null): the printed label chain of the FIRST question the section covers, following the same PATH rules as entities (["4"], ["11"]). Fill it when the section states where it begins ("Q.4 to Q.20", "questions 11-15"), when a numeric pattern fixes it ("1x60=60" -> ["1"]), or when the section header is immediately followed by this page's first question whose printed path is visible. null otherwise.

- "endPath" (array of strings, or null): the printed label chain of the LAST question the section covers. STRICT RULE — include "endPath" ONLY when the end is EXPLICITLY stated on the page or EXACTLY derivable from a printed numeric pattern:
    * explicit text:  "Q.4 to Q.20" / "questions 11 to 15" / "Attempt any 10 of Q.1-Q.15"  -> endPath ["20"] / ["15"] / ["15"]
    * numeric pattern: "1x60=60" or "60x1" (1 mark x 60 questions) -> startPath ["1"], endPath ["60"]; "5x8=40" (5 marks x 8 questions) -> startPath ["1"], endPath ["8"] (start relative to the section's own numbering when the section does not name its first question).
  NEVER guess an endPath from where THIS page's content happens to stop, NEVER set the last visible question as the end, and NEVER extend a range across pages. If the section does not state or pattern-derive its end, "endPath" MUST be null — a null endPath means "until the next section or the end of the paper", which downstream stitching resolves correctly. A WRONG endPath corrupts per-question marks far more than a missing one.

- "continuesPathFromPrevious" (boolean or null): true ONLY when this page's section declaration continues a section declared on an EARLIER page (the header repeats on this page, or the page prints "(contd.)" / "continued" next to it). In that case emit ONE object for the whole continued range with the SAME "label" and this flag true. false or null when the section starts fresh on this page.

- "eachMarks" (number or null): marks per question stated by the section — "2 marks each" -> 2, "1x60=60" -> 1, "5x8=40" -> 5. null when not stated. Marks printed on an individual question always override the section value downstream.

SECTION RULES:
1. Do NOT re-declare a section for questions that merely fall under a section declared on an earlier page — use "continuesPathFromPrevious": true for that.
2. Copy label text verbatim; copy path labels exactly like entity paths (PATH rules apply).
3. When in doubt about the end of a range, leave "endPath" null. When in doubt about marks, leave "eachMarks" null.

---
## Reading order & boundaries & patterns (CRITICAL)

- Read in the order of the path. 
- Transcribe page-cut-off content exactly as printed — never complete a fragment and never reach into the next page. Content cut at the page bottom IS an entity in "entities" under its printed path (even if the text stops mid-sentence); only continuation text at the page top with no printed label is reported through "startState.obj". Never invent paths.
- Subject classification when determinable: "maths", "physics", "chemistry", "grammar", "comprehension" for English non-grammar questions. null when not inferable.
- Section range/annotation patterns ("1x60=60", "Q.4 to Q.20") are governed by the "## SECTIONS" block above.
- When reading a answer key table, if table is having consistency in keys like: (a/b/c/d), all other annotations like: i, ii should be in the path.
  There might be alphabets in the path itself like: 21.a.b. This means, b is the answer of ["21", "a"]. Always look for patterns and consistency.
- While reading solutions they might be represented as: 21(a), 22(d). Here 'a' and 'd' might be answer keys, not path. 
  If they had been path, it would be consistency. So, distinguish between answer keys and path. But, every roman numeral/alphabetes or any other way of annotation
  before question is most probably path.
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

### Example 1 — hierarchical sub-questions with a stem, MCQ options, no figures; clean boundaries
\`\`\`json
{
  "pageNo": 7,
  "isRelevant": true,
  "startState": { "refPath": ["4"], "obj": null },
  "endState": { "refPath": ["5"] },
  "sections": null,
  "entities": [
    {
      "path": ["4"],
      "passage": null,
      "question": {
        "text": "4. Answer the following in one word:",
        "hasFigure": false,
        "marks": 2,
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
        "subject": null,
        "isStandalone": false
      },
      "solution": {
        "text": null,
        "hasFigure": false,
        "marks": null,
        "subject": null,
        "isStandalone": false,
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
        "subject": "physics",
        "isStandalone": true
      },
      "solution": {
        "text": "Using $v^2 = u^2 - 2gh$ with $v = 0$: $$h = \\\\frac{v^2}{2g}$$",
        "hasFigure": false,
        "marks": null,
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

### Example 2 — page opens mid-solution AND ends mid-question; figure-bearing entity; answer-key row
\`\`\`json
{
  "pageNo": 8,
  "isRelevant": true,
  "startState": {
    "refPath": null,
    "obj": {
      "passage": null,
      "question": null,
      "solution": {
        "text": "...therefore $\\\\omega = \\\\sqrt{k/m}$, giving the angular frequency.",
        "hasFigure": false,
        "marks": null,
        "subject": "physics",
        "isStandalone": false,
        "answerValue": null
      },
      "options": null,
      "answerKey": null
    }
  },
  "sections": [
    {
      "label": "Section B (Q.4 to Q.20) — 2 marks each",
      "startPath": ["4"],
      "endPath": ["20"],
      "continuesPathFromPrevious": null,
      "eachMarks": 2
    }
  ],
  "entities": [
    {
      "path": ["4", "ii"],
      "passage": null,
      "question": {
        "text": "",
        "hasFigure": true,
        "marks": 2,
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
        "marks": null,
        "subject": null,
        "isStandalone": false,
        "answerValue": null
      },
      "options": null,
      "answerKey": "A"
    },
    {
      "path": ["7"],
      "passage": null,
      "question": {
        "text": "A solid sphere of mass $M$ rolls without slipping down",
        "hasFigure": false,
        "marks": null,
        "subject": "physics",
        "isStandalone": true
      },
      "solution": null,
      "options": null,
      "answerKey": null
    }
  ],
  "endState": {
    "refPath": ["7"]
  }
}
\`\`\`
(The page opens with the tail of question 3's solution - no label re-printed, so "startState.refPath" is null and the continuation text lives in "startState.obj". Question 7's stem stops mid-sentence at the bottom: its visible head is an entity in "entities" under path ["7"], and "endState.refPath" points to that same path - the bottom state is a reference only, never content. The continuation of question 7's text appears on the next page's "startState.obj". The section header prints its range "Q.4 to Q.20" explicitly, so "endPath" is ["20"]; without a printed range or a numeric pattern like "1x60=60", "endPath" must be null.)

### Example 3 — reading passage page
\`\`\`json
{
  "pageNo": 12,
  "isRelevant": true,
  "startState": { "refPath": null, "obj": null },
  "sections": null,
  "entities": [
    {
      "path": null,
      "passage": {
        "text": "Climate change poses unprecedented challenges to global agricultural productivity. As temperatures rise and precipitation patterns become erratic, staple crops such as wheat and rice experience declining yields.",
        "startQuestionPath": ["15"],
        "endQuestionPath": ["16"]
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
    },
    {
      "path": ["16"],
      "passage": null,
      "question": {
        "text": "16. According to the passage, which crop is the most vulnerable to shifting",
        "hasFigure": false,
        "marks": null,
        "subject": "comprehension",
        "isStandalone": true
      },
      "solution": null,
      "options": null,
      "answerKey": null
    }
  ],
  "endState": {
    "refPath": ["16"]
  }
}
\`\`\`
(The passage entity has no printed label, so "path" is null. Question 16's stem stops mid-sentence at the bottom: its visible head is an entity in "entities" under path ["16"], and "endState.refPath" points to that path. The continuation of question 16 appears on the next page's "startState.obj".)`;

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
      const contextLines: string[] = [];
      if (target.questionText?.trim()) {
        contextLines.push(
          `     question text: "${target.questionText.trim().slice(0, 300)}"`,
        );
      }
      for (const [option, text] of Object.entries(
        target.optionTexts ?? {},
      ) as Array<["A" | "B" | "C" | "D", string | undefined]>) {
        if (text?.trim()) {
          contextLines.push(
            `     option ${option} text: "${text.trim().slice(0, 200)}"`,
          );
        }
      }
      return [
        `  ${index + 1}. path: ${displayPath(target.path)} — extract ${parts.join(", ")}`,
        ...contextLines,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const hasUnlabeled = targets.some(
    (target) => !target.path || target.path.length === 0,
  );
  const hasFragmentSlots = targets.some(
    (target) => target.path?.[0] === "@start",
  );

  return `You are a figure-localization engine. Read the SAME page ${pageNo} image that a previous OCR stage transcribed, and output bounding boxes ONLY for the parts listed below.

## Targets (the ONLY parts you report)
${targetLines}
${
  hasFragmentSlots
    ? '\nA target whose path is ["@start"] is the page-top continuation fragment (content continuing at the top of the page, belonging to an entity whose label is not printed there). It still refers to real printed content on THIS page — localize it like any other target and ECHO its exact path.\n'
    : ""
}${hasUnlabeled ? '\nOne target has path null: it is the entity whose content continues from the previous page and had no printed label. Report it with "path": null.\n' : ""}
## How to pick the RIGHT diagram (READ before boxing)
- Read each target's question text / option text (printed above when available) FIRST, then scan the page. A diagram belongs to an entity only when it actually depicts what that text describes — same objects, same labeled quantities, symbols, or structures the question refers to, and typically located in the same column/row region as the entity.
- Several diagrams may sit close together (or belong to neighboring questions). Use the text to pick the right SET of diagrams — never take whichever diagram happens to be nearest.
- If no diagram on this page genuinely corresponds to what the entity's text describes, do NOT grab a similar-looking one.

## Output rules (STRICT)
1. Output one JSON object matching this shape:
   { "items": [ { "path": ["4","ii"] | null, "questionFigures": [...], "solutionFigures": [...], "optionFigures": { "A": ..., "B": ..., "C": ..., "D": ... }, "noMatchingFigure": false } ] }
2. One item per listed target. ECHO the target's path EXACTLY, character-for-character (same labels, same form, same order — copy it, never re-type or re-format it). For the unlabeled target echo null. A path that does not match a listed path EXACTLY cannot be bound to any target and its boxes are DISCARDED, so a case or label mismatch loses the figure entirely.
3. "questionFigures" / "solutionFigures": ARRAY of one box per separate diagram that belongs to the target's question / solution. Empty array when the part you were told to localize has no diagram ON THIS PAGE (e.g. the diagram sits on the other page of a split entity).
4. "optionFigures": object with keys "A","B","C","D". A key holds ONE box when that option's diagram was requested; null otherwise. Set null for every option you were not told to localize.
5. You localize ONLY the parts listed above and NOTHING else — no hallucinations: never report a box for a question/solution/option that is not in the target list, never report a box for a path that is not in the list, never invent additional items. Figures belonging to OTHER entities on the page (any path not listed above) must NOT be reported at all.
6. "noMatchingFigure": after reading the question text / option text and examining the page, set true when NO diagram on this page actually corresponds to that entity's content (false positive in the earlier stage's figure flag, or the diagram belongs to a different question). When true, leave "questionFigures" and "solutionFigures" empty and "optionFigures" values null for that item — never guess boxes for a diagram you cannot confidently match. Set false whenever a genuine matching diagram exists.
7. If a listed part's diagram is not visible on this page for another reason (it sits on the other page of a split entity), return an empty array / null with "noMatchingFigure": false — do not guess.

## Coordinate system (CRITICAL)
- Output INTEGER coordinates on a 0-1000 grid scaled to the FULL page (origin top-left, x grows right, y grows down). Example: a box covering the whole page is {"xMin":0,"yMin":0,"xMax":1000,"yMax":1000}.
- xMin/yMin/xMax/yMax are integers in [0, 1000] with xMax > xMin and yMax > yMin.
- On two-column pages x is measured across the WHOLE page width: the left column spans roughly x 0..500, the right column 500..1000.
- Box each SEPARATE diagram individually — do not merge distinct figures into one box.
- Tight boxes that include captions/labels belonging to the figure, but exclude neighboring text, option letters, and serial numbers.
- The output drives an automated cropping pipeline — inaccurate boxes cut off figures or crop blank regions. Be precise.`;
}
