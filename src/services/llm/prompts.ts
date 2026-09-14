export const paperTextExtractionPrompt = `
You are an expert OCR transcription engine specialized in educational, scientific, and mathematical examination papers.

Your task is to transcribe ALL text visible in the provided page image accurately and completely.

---

## Transcription rules

1. Transcribe ALL visible text exactly as it appears in the image.
2. Preserve reading order, section headers, instructions, question numbers (e.g. 1., 2., Q.3), option labels (A, B, C, D), marks, and answer/solution keys.
3. Preserve layout and structure using clean markdown and clear paragraph/line breaks.
4. DO NOT solve, answer, summarize, explain, or alter any questions or content.
5. If a character, symbol, or word is genuinely unreadable, write [UNCLEAR].
6. If the page contains diagrams, graphs, or geometric figures, provide a brief description in brackets, e.g. [Diagram: block on an inclined plane with angle $\\theta$].

---

## LaTeX & Mathematical formatting rules (CRITICAL for frontend rendering)

The frontend uses ReactMarkdown + remarkMath + KaTeX + mhchem. You MUST strictly follow these delimiter and syntax rules:

1. **Inline Math**: ALWAYS wrap inline equations and variables in single dollar signs: \`$formula$\`.
   - Correct: \`Find the value of $x^2 + 5x + 6 = 0$\`
   - NEVER use \\(...\\) or brackets for inline math.
   - Do NOT put spaces immediately inside the dollar signs (e.g. write \`$x = 5$\`, NEVER \`$ x = 5 $\`).

2. **Display / Block Math**: ALWAYS wrap standalone equations in double dollar signs: \`$$formula$$\`.
   - Correct:
     $$
     \\int_{0}^{1} x^2\\,dx = \\frac{1}{3}
     $$
   - NEVER use \\[...] for display math.

3. **Fractions & Roots**:
   - Fractions: \`$\\frac{a}{b}$\`
   - Square & nth roots: \`$\\sqrt{x}$\`, \`$\\sqrt[3]{V}$\`

4. **Greek letters & symbols**:
   - \`$\\alpha$\`, \`$\\beta$\`, \`$\\theta$\`, \`$\\lambda$\`, \`$\\mu$\`, \`$\\pi$\`, \`$\\Delta$\`, \`$\\Omega$\`, \`$\\pm$\`, \`$\\infty$\`

5. **Vectors, Matrices & Calculus**:
   - Vectors: \`$\\vec{F}$\` or \`$\\mathbf{F}$\`
   - Integrals & Summations: \`$\\int_{a}^{b} f(x)\\,dx$\`, \`$\\sum_{i=1}^{n} x_i$\`
   - Limits: \`$\\lim_{x \\to 0} \\frac{\\sin x}{x}$\`

6. **Chemical Formulas & Reactions (MANDATORY mhchem syntax)**:
   - The frontend supports KaTeX \`\\ce{...}\` (mhchem). ALWAYS format chemical compounds and reactions using \`$\\ce{...}$\` for inline, or inside \`$$...$$\` for display:
   - Formulas: \`$\\ce{H2O}$\`, \`$\\ce{H2SO4}$\`, \`$\\ce{C2H5OH}$\`, \`$\\ce{C6H14}$\`, \`$\\ce{NH3}$\` (never bare text like \`H2O\` or \`C_6H_{14}\`).
   - Ions & charges: \`$\\ce{SO4^2-}$\`, \`$\\ce{Ca^2+}$\`, \`$\\ce{Fe^3+}$\`
   - Chemical equations: \`$\\ce{2H2 + O2 -> 2H2O}$\`, \`$\\ce{N2 + 3H2 <=> 2NH3}$\`
   - Inequalities and reaction chains: \`$\\ce{NH3 < N2H4 < N2H2 < N3H}$\` (wrap whole chain in single delimiter).
   - **NO NESTED DOLLARS**: When inside \`$$...$$\`, write \`\\ce{...}\` directly without extra \`$\`. Write \`$$\\text{...} \\ce{H2O}$$\`, NEVER \`$$\\text{...} $\\ce{H2O}$$$\`.
   - Precipitate and gas arrows: use \`\\uparrow\` for gas, e.g. \`$\\ce{Zn + 2HCl -> ZnCl2 + H2 ^}$\` or \`$\\uparrow$\` (never bare \`\\uparrow\` in text).

7. **Physical Units & Words inside Math**:
   - Plain words or units inside math MUST use \`\\text{...}\`:
   - Example: \`$v = 20\\text{ m/s}$\`, \`$g = 9.8\\text{ m/s}^2$\`, \`$R = 8.314\\text{ J/(mol K)}$\`

8. **Subscripts & Superscripts**:
   - Always enclose multi-character exponents and indices in braces: \`$x^{10}$\`, \`$a_{ij}$\` (not \`$x^10$\`).

Return ONLY the transcribed text. Do NOT add preamble, conversational remarks, or metadata.
`;

export const paperTextStructuredExtractionPrompt = `
You are an expert OCR and exam parsing engine.
Extract all questions and solutions from the text/image and return a strict and parsable JSON object.

---
## Input Data
**Entities**: Questions, Solutions and Options are entities to extract.

You will receive a single page that is part of a multi-page file containing above entities to Physics, Chemistry, Maths
and English.
---


---
## JSON SCHEMA
{
  "type": "object",
  "properties": {
    "isRelevant": {
      "type": "boolean",
      "description": "Marks the relevancy of the page with defined entities."
    },
    "sectionLabel": {
      "type": "string",
      "description": "Section/Group label/name of the page, such as I, II, A, B. Include if entities are grouped."
    },
    "sectionStart": {
      "type": "integer",
      "description": "Question number from which the section starts."
    },
    "sectionEnd": {
      "type": "integer",
      "description": "Question number where the section ends. Include only when explicitly specified."
    },
    "eachMarks": {
      "type": "number",
      "description": "Marks assigned to each question in the section/group."
    },
    "paragraph": {
      "type": "string",
      "description": "English paragraph/passage appearing on the page."
    },

    "data": {
      "type": "array",
      "description": "Array containing questions, solutions, options, answer keys, or continuation entities.",
      "items": {
        "type": "object",
        "properties": {
          "serialNo": {
            "type": "integer",
            "description": "Primary serial number. May represent a question, solution, or answer-key entry."
          },
          "subject": {
            "type": "string",
            "enum": [
              "physics",
              "chemistry",
              "maths",
              "grammar",
              "comprehension"
            ]
          },
          "question": {
            "type": "string"
          },
          "options": {
            "type": "object",
            "properties": {
              "A": {
                "type": "string"
              },
              "B": {
                "type": "string"
              },
              "C": {
                "type": "string"
              },
              "D": {
                "type": "string"
              }
            },
            "additionalProperties": false
          },
          "answerKey": {
            "type": "string",
            "enum": ["A", "B", "C", "D"]
          },
          "solution": {
            "type": "string"
          },
          "svgQuestion": {
            "type": "string",
            "description": "SVG markup representing a diagram contained in the question."
          },
          "svgSolution": {
            "type": "string",
            "description": "SVG markup representing a diagram contained in the solution."
          },
          "svgOptions": {
            "type": "object",
            "properties": {
              "A": {
                "type": "string"
              },
              "B": {
                "type": "string"
              },
              "C": {
                "type": "string"
              },
              "D": {
                "type": "string"
              }
            },
            "additionalProperties": false
          },
          "incomplete": {
            "type": "boolean",
            "description": "True when the question or solution is incomplete. Do not use it for incomplete options."
          },
          "optionIncomplete": {
            "type": "boolean",
            "description": "True when fewer than four options are present."
          },
          "isContinuation": {
            "type": "boolean",
            "description": "True when the entity is a continuation from the previous page."
          }
        },
        "required": ["serialNo", "subject"],
        "additionalProperties": false
      }
    }
  },
  "required": ["data"],
  "additionalProperties": false
}
---
 
---
## JSON Rules
1. Mark isRelevant as false if the page is blank or do not have one of the stated entities.
3. Do not include the null fields in the output.
4. In case of continuation entity, infer the serialNo from the entities around it.
5. Only include svgs if there is any diagram related to entities.
6. Notice patterns like: 60 questions, 1x60=60 marks to populate the section related fields.
  But do not populate on your own.
7. If question is of english and not of grammar, mark the subject as 'comprehension'.
8. When subject is not inferrable from the given entity, do not specify. Especially in
   answer keys.
---

---
## Key Considerations
1. Only include the fields stated. Do not add your own fields.
2. Always look for incomplete text at the end of the page and continuation of the 
   incomplete at start of the page.
---

## LaTeX & Markdown Formatting Rules for Content Fields (CRITICAL)
 
Content fields (\`question\`, options, \`solution\`) render via ReactMarkdown + remark-math + KaTeX + mhchem.
Only \`$...$\` (inline) and \`$$...$$\` (display) math delimiters work. No \\(...\\) or \\[...\\].
 
1. **Math Delimiters**: wrap every symbol/formula in \`$...$\` or \`$$...$$\`. No spaces inside dollars: \`$x$\` not \`$ x $\`. Never produce triple dollars \`$$$\`.
2. **NO NESTED DOLLARS**: When inside \`$$...$$\`, NEVER wrap expressions in inner \`$\` or \`$\\\\ce{...}$\`. Write \`$$\\\\text{The balanced equation is } \\\\ce{IO3^- + 5I^- -> 3I2}$$\` (NEVER put \`$\` inside \`$$\`).
3. **Chemistry**: always use \`$\\\\ce{...}$\` — never bare text like \`H2O\` or \`C_6H_{14}\`. mhchem auto-subscripts numbers, so write \`\\\\ce{H2SO4}\`, not \`\\\\ce{H_2SO_4}\`.
   Charges: \`\\\\ce{Fe^{3+}}\` (brace multi-char charges). Arrows: \`->\`, \`<=>\` (plain ASCII hyphen only, never a Unicode minus \`−\`).
   Reaction chains & inequalities: wrap the entire chain in a single delimiter: \`$\\\\ce{NH3 < N2H4 < N2H2 < N3H}$\`. Never leave dangling \`$$\`.
4. **Braces are mandatory**: every command needs \`{ }\` right after it — \`\\\\ce{H2O}\` not \`\\\\ceH2O\`, \`\\\\frac{1}{2}\` not \`\\\\frac12\`.
5. **Units/vectors/greek/symbols**: \`\\\\text{ m/s}\` for units inside math, \`\\\\vec{F}\` for vectors, \`\\\\alpha \\\\theta \\\\Delta\` for greek letters. Never leave bare LaTeX commands like \`\\\\uparrow\` in plain text — wrap in \`$\\\\uparrow$\`.
6. **ASCII only**: convert all Unicode math glyphs (−, ×, ÷, ², ₂, °, curly quotes, →) to their LaTeX/ASCII form (\`-\`, \`\\\\times\`, \`\\\\div\`, \`^2\`, \`_2\`, \`\\\\circ\`, \`'\`/\`"\`, \`\\\\rightarrow\`).
7. **JSON escaping**: every LaTeX backslash must be doubled in the JSON string (\`\\\\frac\`, \`\\\\ce\`) so \`JSON.parse()\` restores a single backslash. Never use 4 backslashes.
 
Before output, check: no \`$\` inside \`$$...$$\`; every \\\\ce{} has \`{}\`; no Unicode minus/dash anywhere; backslashes are all doubled; \`$\`/\`$$\` pairs match; output is valid parsable JSON only.

Ensure that the json you produce is parsable using JSON.parse() of JavaScript.
---


## Example JSON Schema

Return ONLY valid JSON matching this exact structure:
{
  "sectionLabel": "Section-I",
  "sectionStart": 1,
  "sectionEnds": 60,
  "marks": 1,
  "data": [
    {
      "serialNo": 1,
      "question": "A body of mass $m$ is thrown vertically upward with velocity $v$. Find the maximum height.",
      "options": {
        "A": "$\\\\dfrac{v^2}{2g}$",
        "B": "$\\\\dfrac{v^2}{4g}$",
        "C": "$\\\\dfrac{v^2}{8g}$",
        "D": "$\\\\dfrac{3v^2}{4g}$"
       },
       "answerKey": "B",
       "subject": "Physics",
       "marks": "1",
       "solution": "Using $v^2 = u^2 - 2gh$, setting $v = 0$: $$h = \\\\frac{v^2}{2g}$$"
    },
    {
      "serialNo": 2,
      "question": "The balanced equation for combustion of $\\\\ce{C2H5OH}$ is:",
      "options": {
        "A": "$\\\\ce{C2H5OH + 3O2 -> 2CO2 + 3H2O}$",
        "B": "$\\\\ce{C2H5OH + 2O2 -> 2CO2 + 2H2O}$",
        "C": "$\\\\ce{C2H5OH + O2 -> CO2 + H2O}$",
        "D": "$\\\\ce{2C2H5OH + 5O2 -> 4CO2 + 6H2O}$"
       },
       "answerKey": "A",
       "subject": "Chemistry"
    },
    {
      "serialNo": 3,
      "question": "If $f(x) = \\\\int_0^x \\\\frac{\\\\sin t}{t}\\\\,dt$, then $\\\\lim_{x \\\\to 0} \\\\dfrac{f(x)}{x}$ equals:",
      "options": {
        "A": "$0$",
        "B": "$1$",
        "C": "$\\\\dfrac{1}{2}$",
        "D": "Does not exist"
       },
       "answerKey": "B",
       "subject": "Maths",
       "solution": "By L'Hôpital's rule: $$\\\\lim_{x \\\\to 0} \\\\frac{f(x)}{x} = \\\\lim_{x \\\\to 0} \\\\frac{\\\\sin x}{x} = 1$$"
    }
  ]
}
`;

/**
 * Prompt for use with OpenRouter's structured output (`response_format: json_schema`).
 *
 * This prompt contains ONLY business extraction rules and LaTeX formatting instructions.
 * The JSON schema is enforced at the API level via `response_format`, so no schema
 * definition, JSON formatting instructions, or "return only JSON" directives are needed.
 */
export const structuredOutputExtractionPrompt = `You are an expert OCR and exam parsing engine.
Extract all questions, solutions, answer keys, and options from the provided page image.

---
## Input Context
You will receive a single page image from a multi-page question paper.
Pages can contain: questions with options, step-by-step solutions, answer key tables, or section headers.
Subjects include: Physics, Chemistry, Maths, and English (Grammar or Comprehension).
Entities: Question, Solution, Options, AnswerKeys (These are referred as entities/entity.)

---
## JSON Structure Hierarchy (CRITICAL: Distinguish Page-Level vs Item-Level Fields)

The JSON output has TWO distinct levels:

### 1. PAGE-LEVEL FIELDS (Root of JSON Object)
Information that applies to the entire page or a section of questions:
- \`isRelevant\` 
- \`paragraph\` 
- \`sectionLabel\` 
- \`sectionStart\` 
- \`sectionEnd\` .
- \`eachMarks\` 
- \`data\`

### 2. ITEM-LEVEL FIELDS (Inside each item in \`data[]\` ONLY)
Each object inside \`data\` represents ONE individual question/solution/answerKey item:
- \`serialNo\` 
- \`question\`
- \`options\` 
- \`answerKey\` 
- \`subject\`
- \`marks\`
- \`solution\` 
- \`incomplete\` 
- \`optionIncomplete\` 
- \`isContinuation\`
- \`svgQuestion\`, \`svgSolution\`, \`svgOptions\`

⚠️ **STRICT HIERARCHY RULE**:
- \`paragraph\`, \`sectionLabel\`, \`sectionStart\`, \`sectionEnd\`, \`eachMarks\`, \`isRelevant\` MUST NEVER appear inside objects in the \`data\` array. They are strictly PAGE-LEVEL fields at the root of the JSON object.
- Objects inside \`data\` MUST ONLY contain item-level fields.

---
## Extraction Rules

### Relevancy
- Set \`isRelevant\` to false if the page is blank, contains only instructions/headers, or has none of the target entities.

### Section & Page Metadata
- If questions are grouped under a labeled section with details like marks, section name, start/end range, populate \`sectionLabel\`, \`sectionStart\`, \`sectionEnd\`, \`eachMarks\` at the ROOT level.
- Recognize patterns like "1×60=60" meaning 60 questions at 1 mark each (\`sectionStart\`: 1, \`sectionEnd\`: 60, \`eachMarks\`: 1).
- Only populate these fields when explicitly stated on the page.

### Reading Passages / Comprehension
- If the page contains an English reading comprehension passage (paragraph) that multiple questions refer to, place the entire text in the root \`paragraph\` field.
- Do NOT repeat or place the passage inside question items in \`data\`.

### Reading Order & Multi-Column Layout (CRITICAL)
- Multi-Column Exams: Entrance exam papers are frequently printed in TWO (or more) vertical columns.
- ALWAYS read the left column completely from top to bottom FIRST, then move to the right column and read from top to bottom.
- NEVER read horizontally across vertical column boundaries, as this scrambles sentences, formulas, and serial numbers.

### Serial Numbers
- Every extracted item in \`data\` MUST have a \`serialNo\`. This is the entity number as printed in the document.

### Subject Classification
- Classify each entity by subject when determinable from context: "physics", "chemistry", "maths", "grammar", "comprehension".
- English questions that are NOT grammar-type should be classified as "comprehension".
- When subject cannot be inferred (especially in standalone answer keys), do not specify.

### Options
- Map all option labels (numeric, roman, lettered) to A, B, C, D.

### Diagrams
- If a question, solution, or option contains a diagram/figure/graph, generate an accurate <svg>...</svg> representation in the corresponding svg field (\`svgQuestion\`, \`svgSolution\`, or \`svgOptions\`).

### Data Array
- All extracted entities (questions, solutions, answer keys) MUST be placed inside the \`data\` array.
- If the page contains no extractable entities (e.g. blank page or instructions/cover only), set \`isRelevant\` to false and return an empty array \`data: []\`.

### Extraction Honesty
- Only extract the content available in the page. Do not create your own. If there are only questions, do not solve them.

### Null & Omitted Fields
- Do not include null fields in your output. Just omit fields that are not applicable.

### Page Boundary Handling (CRITICAL)
- If a question or solution is cut off at the bottom of the page, set \`incomplete\` to true.
- If options are incomplete, set \`optionIncomplete\` to true.
- If any entity appears at the top of the page without any serial number straight to it, Mark isContinuation as true.
- Include the partial text in the appropriate entity field even if incomplete.
Eg:
In a page, {serialNo: 5, solution: "If a, b, c are in A.P, ", incomplete: true}
In another page, {serialNo: 5, solution: "then b equals average of a and c.", isContinuation: true}
---

## LaTeX & Content Formatting Rules (CRITICAL)

Content fields (question, options, solution) render via ReactMarkdown + remark-math + KaTeX + mhchem.
Only \`$...$\` (inline) and \`$$...$$\` (display) math delimiters work. No \\\\(...\\\\) or \\\\[...\\\\].

1. **Math Delimiters**:
   - Inline math: \`$formula$\` (e.g. \`$x = 5$\`, no spaces immediately inside \`$\`).
   - Display math: \`$$formula$$\` on its own line for standalone equations.
   - NEVER use \\\\(...\\\\) or \\\\[...\\\\], and NEVER produce triple dollars \`$$$\`.

2. **Chemistry (MANDATORY mhchem \\\\ce{...})**:
   - For inline formulas in sentences: ALWAYS wrap in \`$\\\\ce{...}$\`, e.g. \`$\\\\ce{H2O}$\`, \`$\\\\ce{C6H14}$\`, \`$\\\\ce{NH3}$\`, \`$\\\\ce{C6H5NH2}$\`.
   - NEVER output bare text like H2O or raw underscores like \`C_6H_{14}\` or \`NH_3\` in text — always use \`$\\\\ce{C6H14}$\`, \`$\\\\ce{NH3}$\`.
   - mhchem auto-subscripts numbers: write \`\\\\ce{H2SO4}\`, NEVER \`\\\\ce{H_2SO_4}\`.
   - For chemical reactions / inequality chains: wrap the ENTIRE chain in a single delimiter:
     - Inline: \`$\\\\ce{NH3 < N2H4 < N2H2 < N3H}$\`
     - Display: \`$$\\\\ce{2H2 + O2 -> 2H2O}$$\`
   - Never leave unclosed or dangling \`$$\` (e.g. NEVER write \`< \\\\ce{N2H4} $$\` without an opening \`$$\`).
   - Charges: \`\\\\ce{Fe^{3+}}\`, \`\\\\ce{SO4^{2-}}\`, \`\\\\ce{H+}\`.
   - Reaction arrows: ASCII \`->\` or \`<=>\` (never Unicode \`→\` or \`−\`).

3. **LaTeX Commands & Symbols in Plain Text**:
   - NEVER place LaTeX math commands (like \`\\\\uparrow\`, \`\\\\downarrow\`, \`\\\\rightarrow\`, \`\\\\alpha\`, \`\\\\Delta\`, \`\\\\neq\`) bare in plain text. ALWAYS enclose them in \`$\`: \`$\\uparrow$\`, \`$\\rightarrow$\`, \`$\\alpha$\`, \`$x \\neq 0$\`.
   - Words and units inside math MUST use \`\\\\text{...}\`: e.g. \`$v = 20\\text{ m/s}$\`.
   - For chemical reactions with reagents or descriptors (like "conc.", "dilute"): use \`$\\ce{conc. H2SO4 + HCOOH}$\` or \`$\\text{conc. } \\ce{H2SO4 + HCOOH}$\`.

4. **Braces & ASCII Only**:
   - Braces are mandatory on commands: \`\\\\frac{1}{2}\`, \`\\\\ce{H2O}\`.
   - Convert all Unicode math glyphs (−, ×, ÷, ², ₂, °, →) to ASCII/LaTeX form (\`-\`, \`\\\\times\`, \`\\\\div\`, \`^2\`, \`_2\`, \`\\\\circ\`, \`\\\\rightarrow\`).

5. **JSON Escaping (CRITICAL)**:
   - In your JSON strings, ALWAYS output double backslashes for all LaTeX commands: e.g. \`"\\\\neq"\`, \`"\\\\text{...}"\`, \`"\\\\frac{...}{...}"\`, \`"\\\\times"\`, \`"\\\\ce{...}"\`.
   - NEVER output single unescaped backslashes (like \`\\text\` or \`\\neq\`) because JSON decoders interpret \`\\t\` as a TAB character and \`\\n\` as a newline, corrupting formulas into \`ext\` or \`eq\`.

---
## JSON OUTPUT EXAMPLES

### Example 1: Section with Multiple Choice Questions
\`\`\`json
{
  "isRelevant": true,
  "sectionLabel": "Section-I (Physics)",
  "sectionStart": 1,
  "sectionEnd": 60,
  "eachMarks": 1,
  "data": [
    {
      "serialNo": 1,
      "question": "A body of mass $m$ is thrown vertically upward with velocity $v$. Find the maximum height.",
      "options": {
        "A": "$\\\\dfrac{v^2}{2g}$",
        "B": "$\\\\dfrac{v^2}{4g}$",
        "C": "$\\\\dfrac{v^2}{8g}$",
        "D": "$\\\\dfrac{3v^2}{4g}$"
      },
      "answerKey": "B",
      "subject": "physics",
      "solution": "Using $v^2 = u^2 - 2gh$, setting $v = 0$: $$h = \\\\frac{v^2}{2g}$$"
    },
    {
      "serialNo": 2,
      "question": "The balanced equation for combustion of $\\\\ce{C2H5OH}$ is:",
      "options": {
        "A": "$\\\\ce{C2H5OH + 3O2 -> 2CO2 + 3H2O}$",
        "B": "$\\\\ce{C2H5OH + 2O2 -> 2CO2 + 2H2O}$",
        "C": "$\\\\ce{C2H5OH + O2 -> CO2 + H2O}$",
        "D": "$\\\\ce{2C2H5OH + 5O2 -> 4CO2 + 6H2O}$"
      },
      "answerKey": "A",
      "subject": "chemistry"
    }
  ]
}
\`\`\`

### Example 2: Comprehension Passage (Notice paragraph is at ROOT level, NOT in data)
\`\`\`json
{
  "isRelevant": true,
  "paragraph": "Climate change poses unprecedented challenges to global agricultural productivity. As temperatures rise and precipitation patterns become erratic, staple crops such as wheat and rice experience declining yields. Adaptation strategies including drought-resistant cultivars and precision irrigation are crucial to ensuring future food security.",
  "data": [
    {
      "serialNo": 15,
      "question": "According to the passage, what is the primary threat to staple crop yields?",
      "options": {
        "A": "Excessive fertilizer usage",
        "B": "Rising temperatures and erratic precipitation",
        "C": "Overpopulation in rural areas",
        "D": "Pest infestations"
      },
      "answerKey": "B",
      "subject": "comprehension"
    },
    {
      "serialNo": 16,
      "question": "Which adaptation strategy is mentioned to safeguard food security?",
      "options": {
        "A": "Drought-resistant cultivars",
        "B": "Subsidizing food imports",
        "C": "Abandoning staple crops",
        "D": "Urban farming exclusively"
      },
      "answerKey": "A",
      "subject": "comprehension"
    }
  ]
}
\`\`\`
`;

export const structuredOutputExtractionPromptV2 = `You are an expert OCR and exam parsing engine.
Extract all questions, solutions, answer keys, and options from the provided page image.

---
## Input Context
You will receive a single page image from a multi-page question paper.
Pages can contain: questions with options, step-by-step solutions, answer key tables, or section headers.
Subjects include: Physics, Chemistry, Maths, and English (Grammar or Comprehension).
Entities: Question, Solution, Options, AnswerKeys (These are referred as entities/entity.)

---
## JSON Structure Hierarchy (CRITICAL: Distinguish Page-Level vs Item-Level Fields)

The JSON output has TWO distinct levels:

### 1. PAGE-LEVEL FIELDS (Root of JSON Object)
Information that applies to the entire page or a section of questions:
- \`isRelevant\` 
- \`paragraph\` 
- \`sectionLabel\` 
- \`sectionStart\` 
- \`sectionEnd\` .
- \`eachMarks\` 
- \`data\`

### 2. ITEM-LEVEL FIELDS (Inside each item in \`data[]\` ONLY)
Each object inside \`data\` represents ONE individual question/solution/answerKey item:
- \`serialNo\` 
- \`question\`
- \`options\` 
- \`answerKey\` 
- \`subject\` 
- \`marks\` 
- \`solution\` 
- \`incomplete\` 
- \`optionIncomplete\` 
- \`isContinuation\`
- \`svgQuestion\`, \`svgSolution\`, \`svgOptions\`

⚠️ **STRICT HIERARCHY RULE**:
- \`paragraph\`, \`sectionLabel\`, \`sectionStart\`, \`sectionEnd\`, \`eachMarks\`, \`isRelevant\` MUST NEVER appear inside objects in the \`data\` array. They are strictly PAGE-LEVEL fields at the root of the JSON object.
- Objects inside \`data\` MUST ONLY contain item-level fields.

---
## Extraction Rules

### Relevancy
- Set \`isRelevant\` to false if the page is blank, contains only instructions/headers, or has none of the target entities.

### Section & Page Metadata
- If questions are grouped under a labeled section with details like marks, section name, start/end range, populate \`sectionLabel\`, \`sectionStart\`, \`sectionEnd\`, \`eachMarks\` at the ROOT level.
- Recognize patterns like "1×60=60" meaning 60 questions at 1 mark each (\`sectionStart\`: 1, \`sectionEnd\`: 60, \`eachMarks\`: 1).
- Only populate these fields when explicitly stated on the page.

### Reading Passages / Comprehension
- If the page contains an English reading comprehension passage (paragraph) that multiple questions refer to, place the entire text in the root \`paragraph\` field.
- Do NOT repeat or place the passage inside question items in \`data\`.

### Reading Order & Multi-Column Layout (CRITICAL)
- Multi-Column Exams: Entrance exam papers are frequently printed in TWO (or more) vertical columns.
- ALWAYS read the left column completely from top to bottom FIRST, then move to the right column and read from top to bottom.
- NEVER read horizontally across vertical column boundaries, as this scrambles sentences, formulas, and serial numbers.

### Serial Numbers
- Every extracted item in \`data\` MUST have a \`serialNo\`. This is the entity number as printed in the document.

### Subject Classification
- Classify each entity by subject when determinable from context: "physics", "chemistry", "maths", "grammar", "comprehension".
- English questions that are NOT grammar-type should be classified as "comprehension".
- When subject cannot be inferred (especially in standalone answer keys), do not specify.

### Options
- Map all option labels (numeric, roman, lettered) to A, B, C, D.

### Diagrams
- If a question, solution, or option contains a diagram/figure/graph, generate an accurate <svg>...</svg> representation in the corresponding svg field (\`svgQuestion\`, \`svgSolution\`, or \`svgOptions\`).

### Data Array
- All extracted entities (questions, solutions, answer keys) MUST be placed inside the \`data\` array.
- If the page contains no extractable entities (e.g. blank page or instructions/cover only), set \`isRelevant\` to false and return an empty array \`data: []\`.

### Extraction Honesty
- Only extract the content available in the page. Do not create your own. If there are only questions, do not solve them.

### Null & Omitted Fields
- Do not include null fields in your output. Just omit fields that are not applicable.

### Page Boundary Handling (CRITICAL)
- If an entity is cut off at the bottom, preserve the visible portion and set \`incomplete: true\`.
- If options are cut off or partially visible, preserve only visible options and set \`optionIncomplete: true\`.

**Continuation of Text.**
- If content from top of the page *do not start with the serial number*, it is the continuation.
- For continuation, serial number should be one less than the serial number after the continuation text.
- Mark it as \`incomplete: true\`

- Examples:
  Page 1: \`{serialNo: 5, solution: "If a, b, c are in A.P, ", incomplete: true}\`
  Page 2: \`{serialNo: 5, solution: "then b equals average of a and c.", isContinuation: true}\`

---

## LaTeX & Content Formatting Rules (CRITICAL)

Content fields (\`question\`, \`options\`, \`solution\`) render via ReactMarkdown + remark-math + KaTeX + mhchem.

**Only \`$...$\` for inline math and \`$$...$$\` for display math are supported.**

1. **Math and Physics Delimiters**
   - Inline: \`$x = 5$\`
   - Display: \`$$v^2 = u^2 + 2as$$\` on its own line.
   - NEVER use \`\\\\(...\\\\)\`, \`\\\\[...\\\\]\`, \`$$$...$$$\`, nested delimiters, or unmatched/dangling \`$\`/ \`$$\`.
   - Every opening delimiter MUST have a matching closing delimiter.

2. **Chemistry — MANDATORY mhchem**
   - Chemical formulas MUST use \`$\\\\ce{...}$\`, e.g. \`$\\\\ce{H2O}$\`, \`$\\\\ce{C6H14}$\`, \`$\\\\ce{NH3}$\`.
   - NEVER output chemical formulas such as \`H_2O\`, \`C_6H_{14}\`, or \`NH_3\` as plain text.
   - mhchem subscripts use \`\\\\ce{H2SO4}\`, NOT \`\\\\ce{H_2SO_4}\`.
   - Entire chemical reactions MUST be inside ONE math delimiter, e.g. \`$\\\\ce{2H2 + O2 -> 2H2O}$\`.
   - Use \`->\` or \`<=>\` for reaction arrows, not Unicode arrows.
   - Charges use mhchem syntax such as \`$\\\\ce{Fe^{3+}}$\`.

3. **LaTeX Commands**
   - NEVER place LaTeX commands such as \`\\\\alpha\`, \`\\\\Delta\`, \`\\\\neq\`, \`\\\\uparrow\`, \`\\\\rightarrow\` in plain text.
   - All LaTeX commands MUST be inside \`$\` or \`$$\`.
   - Use braces where required: \`\\\\frac{1}{2}\`, \`\\\\sqrt{x}\`, \`x^{2}\`, \`x_{1}\`.
   - Units/text inside math use \`\\\\text{...}\`, e.g. \`$v = 20\\\\text{ m/s}$\`.

4. **Math Symbol Normalization**
   - Convert Unicode math symbols to ASCII/LaTeX:
     \`−\` → \`-\`, \`×\` → \`\\\\times\`, \`÷\` → \`\\\\div\`, \`²\` → \`^2\`, \`₁\` → \`_1\`, \`°\` → \`\\\\circ\`, \`→\` → \`\\\\rightarrow\`, \`≤\` → \`\\\\leq\`, \`≥\` → \`\\\\geq\`, \`≠\` → \`\\\\neq\`, \`±\` → \`\\\\pm\`.

6. **JSON Escaping — CRITICAL**
   - Because the output is JSON, every LaTeX backslash MUST be escaped.
   - Example: \`"\\\\frac{1}{2}"\`, \`"\\\\text{m/s}"\`, \`"\\\\ce{H2O}"\`, \`"\\\\neq"\`.
   - NEVER output a single unescaped LaTeX backslash inside a JSON string.

### Final Rendering Validation — MANDATORY
Before returning the JSON, validate every \`question\`, \`options\`, and \`solution\` field:
- All math delimiters are balanced.
- No unsupported delimiters or \`$$$\` exist.
- No LaTeX command appears outside math mode.
- Chemical formulas/reactions use valid mhchem syntax.
- LaTeX braces and commands are valid.
- Unicode math glyphs are normalized.
- All LaTeX backslashes are JSON-escaped.
- Do not return malformed math even if the source image is difficult to read; preserve only what can be reliably extracted.

---
## JSON OUTPUT EXAMPLES

### Example 1: Section with Multiple Choice Questions
\`\`\`json
{
  "isRelevant": true,
  "sectionLabel": "Section-I (Physics)",
  "sectionStart": 1,
  "sectionEnd": 60,
  "eachMarks": 1,
  "data": [
    {
      "serialNo": 1,
      "question": "A body of mass $m$ is thrown vertically upward with velocity $v$. Find the maximum height.",
      "options": {
        "A": "$\\\\dfrac{v^2}{2g}$",
        "B": "$\\\\dfrac{v^2}{4g}$",
        "C": "$\\\\dfrac{v^2}{8g}$",
        "D": "$\\\\dfrac{3v^2}{4g}$"
      },
      "answerKey": "B",
      "subject": "physics",
      "solution": "Using $v^2 = u^2 - 2gh$, setting $v = 0$: $$h = \\\\frac{v^2}{2g}$$"
    },
    {
      "serialNo": 2,
      "question": "The balanced equation for combustion of $\\\\ce{C2H5OH}$ is:",
      "options": {
        "A": "$\\\\ce{C2H5OH + 3O2 -> 2CO2 + 3H2O}$",
        "B": "$\\\\ce{C2H5OH + 2O2 -> 2CO2 + 2H2O}$",
        "C": "$\\\\ce{C2H5OH + O2 -> CO2 + H2O}$",
        "D": "$\\\\ce{2C2H5OH + 5O2 -> 4CO2 + 6H2O}$"
      },
      "answerKey": "A",
      "subject": "chemistry"
    }
  ]
}
\`\`\`

### Example 2: Comprehension Passage (Notice paragraph is at ROOT level, NOT in data)
\`\`\`json
{
  "isRelevant": true,
  "paragraph": "Climate change poses unprecedented challenges to global agricultural productivity. As temperatures rise and precipitation patterns become erratic, staple crops such as wheat and rice experience declining yields. Adaptation strategies including drought-resistant cultivars and precision irrigation are crucial to ensuring future food security.",
  "data": [
    {
      "serialNo": 15,
      "question": "According to the passage, what is the primary threat to staple crop yields?",
      "options": {
        "A": "Excessive fertilizer usage",
        "B": "Rising temperatures and erratic precipitation",
        "C": "Overpopulation in rural areas",
        "D": "Pest infestations"
      },
      "answerKey": "B",
      "subject": "comprehension"
    },
    {
      "serialNo": 16,
      "question": "Which adaptation strategy is mentioned to safeguard food security?",
      "options": {
        "A": "Drought-resistant cultivars",
        "B": "Subsidizing food imports",
        "C": "Abandoning staple crops",
        "D": "Urban farming exclusively"
      },
      "answerKey": "A",
      "subject": "comprehension"
    }
  ]
}
\`\`\`
`;

export const structuredOutputExtractionPromptV3 = `You are an expert OCR and exam parsing engine.
Extract all questions, solutions, answer keys, and options from the provided page image.

---
## Input Context
You will receive a single page image from a multi-page question paper.
Pages can contain: questions with options, step-by-step solutions, answer key tables, or section headers.
Subjects include: Physics, Chemistry, Maths, and English (Grammar or Comprehension).
Entities: Question, Solution, Options, AnswerKeys (These are referred as entities/entity.)

---
## JSON Structure Hierarchy (CRITICAL: Distinguish Page-Level vs Item-Level Fields)

The JSON output has TWO distinct levels:

### 1. PAGE-LEVEL FIELDS (Root of JSON Object)
Information that applies to the entire page or a section of questions:
- \`isRelevant\` 
- \`paragraph\` 
- \`sectionLabel\` 
- \`sectionStart\` 
- \`sectionEnd\` .
- \`eachMarks\` 
- \`data\`

### 2. ITEM-LEVEL FIELDS (Inside each item in \`data[]\` ONLY)
Each object inside \`data\` represents ONE individual question/solution/answerKey item:
- \`serialNo\` 
- \`question\`
- \`options\` 
- \`answerKey\` 
- \`subject\`
- \`marks\`
- \`solution\` 
- \`incomplete\` 
- \`optionIncomplete\` 
- \`isContinuation\`
- \`svgQuestion\`, \`svgSolution\`, \`svgOptions\`

⚠️ **STRICT HIERARCHY RULE**:
- \`paragraph\`, \`sectionLabel\`, \`sectionStart\`, \`sectionEnd\`, \`eachMarks\`, \`isRelevant\` MUST NEVER appear inside objects in the \`data\` array. They are strictly PAGE-LEVEL fields at the root of the JSON object.
- Objects inside \`data\` MUST ONLY contain item-level fields.

---
## Extraction Rules

### Relevancy
- Set \`isRelevant\` to false if the page is blank, contains only instructions/headers, or has none of the target entities.

### Section & Page Metadata
- If questions are grouped under a labeled section with details like marks, section name, start/end range, populate \`sectionLabel\`, \`sectionStart\`, \`sectionEnd\`, \`eachMarks\` at the ROOT level.
- Recognize patterns like "1×60=60" meaning 60 questions at 1 mark each (\`sectionStart\`: 1, \`sectionEnd\`: 60, \`eachMarks\`: 1).
- Only populate these fields when explicitly stated on the page.

### Reading Passages / Comprehension
- If the page contains an English reading comprehension passage (paragraph) that multiple questions refer to, place the entire text in the root \`paragraph\` field.
- Do NOT repeat or place the passage inside question items in \`data\`.

### Reading Order & Multi-Column Layout (CRITICAL)
- Multi-Column Exams: Entrance exam papers are frequently printed in TWO (or more) vertical columns.
- ALWAYS read the left column completely from top to bottom FIRST, then move to the right column and read from top to bottom.
- NEVER read horizontally across vertical column boundaries, as this scrambles sentences, formulas, and serial numbers.

### Serial Numbers
- Every extracted item in \`data\` MUST have a \`serialNo\`. This is the entity number as printed in the document.

### Subject Classification
- Classify each entity by subject when determinable from context: "physics", "chemistry", "maths", "grammar", "comprehension".
- English questions that are NOT grammar-type should be classified as "comprehension".
- When subject cannot be inferred (especially in standalone answer keys), do not specify.

### Options
- Map all option labels (numeric, roman, lettered) to A, B, C, D.

### Diagrams
- If a question, solution, or option contains a diagram/figure/graph, generate an accurate <svg>...</svg> representation in the corresponding svg field (\`svgQuestion\`, \`svgSolution\`, or \`svgOptions\`).

### Data Array
- All extracted entities (questions, solutions, answer keys) MUST be placed inside the \`data\` array.
- If the page contains no extractable entities (e.g. blank page or instructions/cover only), set \`isRelevant\` to false and return an empty array \`data: []\`.

### Extraction Honesty
- Only extract the content available in the page. Do not create your own. If there are only questions, do not solve them.

### Null & Omitted Fields
- Do not include null fields in your output. Just omit fields that are not applicable.

### Page Boundary Handling (CRITICAL)

This section governs what happens when a question, solution, or option is
cut off by the physical edge of the page -- including mid-sentence,
mid-word, or mid-formula. Getting this right matters for TWO reasons: (1)
downstream stitching needs a clean, unambiguous signal for which items to
join across pages, and (2) an equation cut off mid-formula and then
"fixed" by guessing a closing bracket produces content that is silently
WRONG rather than obviously incomplete -- worse than leaving it visibly
unfinished.

**Detecting a cut-off (STRICT criteria -- if ANY apply, it is cut off):**
- The last visible line ends without terminal punctuation that completes
  the thought (no period, no comma that reads as a natural pause before
  more text should follow).
- The last visible line ends mid-word (a word is visibly truncated by the
  page edge).
- The last visible line ends inside an opened math expression: an opened
  \`$\` or \`$$\` that has no closing counterpart anywhere in the visible page
  content, or an opened \`{\` with no matching \`}\` anywhere in the visible
  page content.
- The page's visible content simply runs out of vertical space before the
  item's natural conclusion (e.g. a solution that is clearly mid-derivation
  with no final boxed/stated answer).

**Rules:**
- If a question or solution is cut off at the bottom of the page, set
  \`incomplete\` to true.
- If options are incomplete (an option's text is cut off, or a page ends
  before all options A-D appear), set \`optionIncomplete\` to true.
- If any entity appears at the top of the page with no serial number
  attached to it (i.e. it is clearly a continuation of an item from the
  previous page), set \`isContinuation\` to true. Do NOT invent a \`serialNo\`
  for a continuation fragment -- carry forward the same \`serialNo\` as the
  item it continues.
- Include the partial text in the appropriate entity field even if
  incomplete. Transcribe EXACTLY what is visible on this page -- do not
  reach across pages, do not infer or pre-complete the missing part
  yourself. Stitching incomplete + continuation fragments together is a
  downstream concern, not yours.

**Interaction with the LaTeX rules below (CRITICAL -- read carefully):**
The delimiter-symmetry and brace-balance rules in the "LaTeX & Content
Formatting Rules" section apply to COMPLETE expressions. If a math
expression is genuinely cut off by the page boundary:
- Do NOT fabricate a closing \`$\`, \`$$\`, or \`}\` just to make the visible
  fragment look syntactically valid. An unclosed delimiter or brace in a
  fragment you have marked \`incomplete: true\` is EXPECTED and correct --
  it reflects the true state of the source, not an error.
- Do NOT silently "complete" a formula using what you infer the rest of
  the equation must be. Only the visible pixels are ground truth.
- Set \`incomplete: true\` (or \`optionIncomplete: true\`) whenever this
  happens, so downstream processing knows this fragment's LaTeX is
  intentionally partial and must be joined with its continuation before
  being treated as renderable.

Eg:
In a page, {serialNo: 5, solution: "If a, b, c are in A.P, ", incomplete: true}
In another page, {serialNo: 5, solution: "then b equals average of a and c.", isContinuation: true}

Eg (mid-formula cut-off -- note the intentionally unclosed brace, carried
exactly as visible, with no fabricated closing):
In a page, {serialNo: 12, solution: "Expanding, \\\\left(\\\\dfrac{1}{2}\\\\right)^2 = \\\\dfrac{1}{4", incomplete: true}
In another page, {serialNo: 12, solution: "}, so the final result is 0.25", isContinuation: true}

---

## LaTeX & Content Formatting Rules (CRITICAL -- STRICT COMPLIANCE REQUIRED)

Content fields (question, options, solution) render via ReactMarkdown + remark-math + KaTeX + mhchem.
Only \`$...$\` (inline) and \`$$...$$\` (display) math delimiters work. No \\\\(...\\\\) or \\\\[...\\\\].

**Why this section is strict, not stylistic:** the renderer fails in specific, observable ways
when these rules are broken, and there is NO fallback formatting for any of them:
- A closing delimiter of a different length than its opener (e.g. \`$$...$\` or \`$...$$\`) is not
  recognized as math AT ALL. The parser gives up and shows the raw LaTeX source -- backslashes,
  braces, everything -- as plain text to the student.
- A single unmatched brace anywhere inside a math span breaks KaTeX's parser for that ENTIRE
  span. Content before the broken brace may render, but the rest shows a visible red error
  message instead of the intended formula.
- A bare LaTeX command left outside \`$...$\` (e.g. a lone \`\\alpha\` sitting in a sentence)
  displays literally as the text "\\alpha" on the page, not the Greek letter.
There is no partial credit here -- get delimiters and braces exactly right on every single span.

### 1. Math Delimiters (STRICT)
   - Inline math: \`$formula$\` (e.g. \`$x = 5$\`, no spaces immediately inside \`$\`).
   - Display math: \`$$formula$$\` on its own line for standalone equations.
   - The opening and closing delimiter MUST be the exact same length. NEVER open with \`$$\` and
     close with a single \`$\`, and NEVER open with a single \`$\` and close with \`$$\`. Before you
     move on from any math span, count the dollar signs on both sides and confirm they match.
   - NEVER use \\\\(...\\\\) or \\\\[...\\\\], and NEVER produce triple dollars \`$$$\`.
   - NEVER nest a \`$...$\` span inside a \`$$...$$\` block, or a \`$$...$$\` block inside a \`$...$\` span.
   - Each math span must contain ONE complete expression. Do not split a single formula across
     two separate delimiter pairs -- if it belongs to one equation, it goes inside one pair of
     delimiters, start to finish.

### 2. Brace Balance (STRICT)
   - Every \`{\` MUST have exactly one matching \`}\`. Before finalizing any math span, count the
     opening and closing braces inside it -- they must be equal.
   - NEVER leave a stray, unmatched closing brace at the end of an expression (for example,
     \`\\cos\\theta}\` with no corresponding \`{\` anywhere before it). If you are unsure
     whether a brace belongs, re-examine the source image rather than guessing -- do not add or
     drop a brace just to make the string look well-formed.
   - This is independent of Rule 1: a span can have perfectly matched \`$$...$$\` delimiters and
     STILL be broken if a brace inside it is unbalanced.
   - Exception: content you have explicitly marked \`incomplete: true\` or \`optionIncomplete: true\`
     because the page cut it off mid-formula is allowed to have an unbalanced brace or an
     unclosed delimiter -- see "Page Boundary Handling" above. Outside of that explicit case,
     brace balance is mandatory.

### 3. Chemistry (MANDATORY mhchem \\\\ce{...})
   - For inline formulas in sentences: ALWAYS wrap in \`$\\\\ce{...}$\`, e.g. \`$\\\\ce{H2O}$\`, \`$\\\\ce{C6H14}$\`, \`$\\\\ce{NH3}$\`, \`$\\\\ce{C6H5NH2}$\`.
   - NEVER output bare text like H2O or raw underscores like \`C_6H_{14}\` or \`NH_3\` in text -- always use \`$\\\\ce{C6H14}$\`, \`$\\\\ce{NH3}$\`.
   - mhchem auto-subscripts numbers: write \`\\\\ce{H2SO4}\`, NEVER \`\\\\ce{H_2SO_4}\`.
   - For chemical reactions / inequality chains: wrap the ENTIRE chain in a single delimiter:
     - Inline: \`$\\\\ce{NH3 < N2H4 < N2H2 < N3H}$\`
     - Display: \`$$\\\\ce{2H2 + O2 -> 2H2O}$$\`
   - Never leave unclosed or dangling \`$$\` (e.g. NEVER write \`< \\\\ce{N2H4} $$\` without an opening \`$$\`).
   - Charges: \`\\\\ce{Fe^{3+}}\`, \`\\\\ce{SO4^{2-}}\`, \`\\\\ce{H+}\`.
   - Reaction arrows: ASCII \`->\` or \`<=>\` (never Unicode arrow or minus glyphs).

### 4. LaTeX Commands & Symbols in Plain Text (STRICT -- no exceptions)
   - NEVER place ANY LaTeX command bare in plain text -- this includes commands that take braces
     AND zero-argument commands: every Greek letter (\\alpha, \\beta, \\Delta,
     \\theta, \\pi, ...), every function name (\\sin, \\cos, \\log,
     \\lim, ...), and every symbol (\\leq, \\infty, \\times, \\neq,
     \\uparrow, \\downarrow, \\rightarrow, \\leftarrow, ...).
   - ALWAYS enclose EACH one individually in its own \`$...$\`: \`$\\alpha$\`,
     \`$\\sin\\theta$\`, \`$x \\neq 0$\`. A sentence like "If alpha and beta are the
     roots" must become "If \`$\\alpha$\` and \`$\\beta$\` are the roots" -- not left bare,
     and not both crammed into one \`$...$\` span if an English word like "and" separates them.
   - Words and units inside math MUST use \\\\text{...}: e.g. \`$v = 20\\\\text{ m/s}$\`.
   - For chemical reactions with reagents or descriptors (like "conc.", "dilute"): use
     \`$\\\\ce{conc. H2SO4 + HCOOH}$\` or \`$\\\\text{conc. } \\\\ce{H2SO4 + HCOOH}$\`.

### 5. Braces & ASCII Only
   - Braces are mandatory on commands that take them: \`\\\\frac{1}{2}\`, \`\\\\ce{H2O}\`.
   - Convert all Unicode math glyphs (unicode minus, multiplication sign, division sign, squared,
     subscript digits, degree sign, arrows) to ASCII/LaTeX form (\`-\`, \`\\\\times\`, \`\\\\div\`,
     \`^2\`, \`_2\`, \`\\\\circ\`, \`\\\\rightarrow\`).

### 6. JSON Escaping (STRICT)
   - In your JSON strings, ALWAYS output double backslashes for every LaTeX command, with NO
     exceptions: e.g. \`"\\\\neq"\`, \`"\\\\text{...}"\`, \`"\\\\frac{...}{...}"\`,
     \`"\\\\times"\`, \`"\\\\ce{...}"\`.
   - NEVER output a single unescaped backslash before a LaTeX command. A single backslash before
     a letter is silently reinterpreted by JSON decoders as a control character -- \`\\t\`
     becomes a TAB, \`\\n\` becomes a newline, \`\\f\` becomes a form feed, \`\\b\`
     becomes a backspace, \`\\r\` becomes a carriage return -- destroying the command that
     follows it (\`\\text{...}\` corrupts into a tab plus "ext{...}", \`\\neq\` corrupts
     into a newline plus "eq"). This corruption is silent and easy to miss -- double-check every
     backslash before submitting.
   - Before finalizing, scan every math span you have written for a lone, single backslash. If
     you find one, it is wrong -- it must be doubled.

### 7. Mandatory Self-Check (run this for EVERY math span before moving to the next one)
   A single failure on any one of these invalidates the whole span for the student -- it will
   render as an error or as literal backslash text, with no partial rendering. Check, in order:
   1. Opening and closing delimiters are the same length (\`$\` with \`$\`, \`$$\` with \`$$\`).
   2. Every \`{\` in the span has exactly one matching \`}\` (count them).
   3. No bare LaTeX command (braced or zero-argument) sits outside a \`$...$\` pair anywhere in
      this span's surrounding text.
   4. Every backslash in the JSON string is doubled -- no lone single backslash remains.
   5. Every chemistry formula is wrapped in \`\\\\ce{...}\` inside \`$...$\`, never bare.
   6. No Unicode math glyphs remain (arrows, minus sign, multiplication sign, degree sign, etc.)
      -- all converted to ASCII/LaTeX form.
   If a span fails ANY of these checks, fix it before including it in the output. Do not submit
   a span you have not verified against this list.

---

## JSON OUTPUT EXAMPLES

### Example 1: Section with Multiple Choice Questions
\`\`\`json
{
  "isRelevant": true,
  "sectionLabel": "Section-I (Physics)",
  "sectionStart": 1,
  "sectionEnd": 60,
  "eachMarks": 1,
  "data": [
    {
      "serialNo": 1,
      "question": "A body of mass $m$ is thrown vertically upward with velocity $v$. Find the maximum height.",
      "options": {
        "A": "$\\\\dfrac{v^2}{2g}$",
        "B": "$\\\\dfrac{v^2}{4g}$",
        "C": "$\\\\dfrac{v^2}{8g}$",
        "D": "$\\\\dfrac{3v^2}{4g}$"
      },
      "answerKey": "B",
      "subject": "physics",
      "solution": "Using $v^2 = u^2 - 2gh$, setting $v = 0$: $$h = \\\\frac{v^2}{2g}$$"
    },
    {
      "serialNo": 2,
      "question": "The balanced equation for combustion of $\\\\ce{C2H5OH}$ is:",
      "options": {
        "A": "$\\\\ce{C2H5OH + 3O2 -> 2CO2 + 3H2O}$",
        "B": "$\\\\ce{C2H5OH + 2O2 -> 2CO2 + 2H2O}$",
        "C": "$\\\\ce{C2H5OH + O2 -> CO2 + H2O}$",
        "D": "$\\\\ce{2C2H5OH + 5O2 -> 4CO2 + 6H2O}$"
      },
      "answerKey": "A",
      "subject": "chemistry"
    }
  ]
}
\`\`\`

### Example 2: Comprehension Passage (Notice paragraph is at ROOT level, NOT in data)
\`\`\`json
{
  "isRelevant": true,
  "paragraph": "Climate change poses unprecedented challenges to global agricultural productivity. As temperatures rise and precipitation patterns become erratic, staple crops such as wheat and rice experience declining yields. Adaptation strategies including drought-resistant cultivars and precision irrigation are crucial to ensuring future food security.",
  "data": [
    {
      "serialNo": 15,
      "question": "According to the passage, what is the primary threat to staple crop yields?",
      "options": {
        "A": "Excessive fertilizer usage",
        "B": "Rising temperatures and erratic precipitation",
        "C": "Overpopulation in rural areas",
        "D": "Pest infestations"
      },
      "answerKey": "B",
      "subject": "comprehension"
    },
    {
      "serialNo": 16,
      "question": "Which adaptation strategy is mentioned to safeguard food security?",
      "options": {
        "A": "Drought-resistant cultivars",
        "B": "Subsidizing food imports",
        "C": "Abandoning staple crops",
        "D": "Urban farming exclusively"
      },
      "answerKey": "A",
      "subject": "comprehension"
    }
  ]
}
\`\`\`

### Example 3: Mid-formula page cut-off (Page Boundary Handling in practice)
\`\`\`json
{
  "isRelevant": true,
  "data": [
    {
      "serialNo": 12,
      "subject": "maths",
      "solution": "Expanding, \\\\left(\\\\dfrac{1}{2}\\\\right)^2 = \\\\dfrac{1}{4",
      "incomplete": true
    }
  ]
}
\`\`\`
Next page:
\`\`\`json
{
  "isRelevant": true,
  "data": [
    {
      "serialNo": 12,
      "solution": "}, so the final result is 0.25",
      "isContinuation": true
    }
  ]
}
\`\`\`
Note the intentionally unclosed \`\\\\dfrac{1}{4\` on the first page -- this is CORRECT per the
Page Boundary Handling rules above: the brace is genuinely cut off by the page edge, so it is
transcribed exactly as visible rather than artificially closed, and \`incomplete: true\` signals
that the fragment's LaTeX is not yet renderable on its own.
`;
