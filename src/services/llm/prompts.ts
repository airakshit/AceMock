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

**Always return parsable JSON. No any formatting or extra text. Just JSON.**
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