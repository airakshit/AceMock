"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import katex from "katex";

// Ensure globalThis.katex is assigned BEFORE mhchem extension is loaded
if (typeof globalThis !== "undefined") {
  (globalThis as Record<string, unknown>).katex = katex;
}
import "katex/contrib/mhchem";

interface RichContentProps {
  /** Raw OCR / markdown text with embedded LaTeX ($...$, $$...$$, \ce{}) */
  text: string;
  /** Additional Tailwind classes to apply to the wrapper */
  className?: string;
}

/**
 * LaTeX commands that take brace-delimited arguments (\frac{1}{3}, \sqrt{2}, ...).
 * Anything on this list found OUTSIDE $...$/$$...$$ delimiters gets auto-wrapped
 * by wrapBareLatexCommands() below. Extend this list as new OCR patterns show up.
 */
const BRACE_MATH_COMMANDS = [
  "dfrac",
  "tfrac",
  "cfrac",
  "frac",
  "sqrt",
  "binom",
  "dbinom",
  "tbinom",
  "overline",
  "underline",
  "widehat",
  "widetilde",
  "vec",
  "hat",
  "bar",
  "dot",
  "ddot",
  "sum",
  "prod",
  "int",
  "oint",
  "iint",
  "iiint",
  "lim",
  "limsup",
  "liminf",
] as const;

/**
 * Brace-matching helper: given str[openIdx] === '{', returns the index of the
 * matching '}' (handling nesting, e.g. \frac{1}{\sqrt{2}}), or -1 if unmatched.
 * Needed because JS regex cannot match arbitrarily-nested braces on its own.
 */
function matchBraceGroup(str: string, openIdx: number): number {
  if (str[openIdx] !== "{") return -1;
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Wraps bare LaTeX commands that take brace arguments — e.g. a stray
 * "\frac{1}{3}" typed/OCR'd outside any $...$ — into "$\frac{1}{3}$" so it
 * actually renders instead of showing up as raw backslash text.
 *
 * Must run AFTER math blocks are protected (placeholder-swapped out) so that
 * every remaining "\command" found here is guaranteed to be outside real
 * math delimiters — otherwise this would double-wrap valid $...$ content.
 *
 * Greedily extends the wrapped span across "glued" +,-,*,/,= operators and
 * chained commands/numbers so "\frac{1}{2}+\frac{1}{3}" becomes ONE math
 * block instead of two adjacent ones. This is a heuristic, not a full LaTeX
 * parser — good enough for typical OCR'd/typed expressions.
 */
function wrapBareLatexCommands(text: string): string {
  const commandRe = new RegExp(
    `\\\\(${BRACE_MATH_COMMANDS.join("|")})\\b`,
    "g",
  );
  let out = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = commandRe.exec(text)) !== null) {
    const start = match.index;
    if (start < cursor) continue; // already swallowed by a previous wrap

    let end = commandRe.lastIndex;

    // optional [...] arg, e.g. \sqrt[3]{8}
    if (text[end] === "[") {
      const close = text.indexOf("]", end);
      if (close !== -1) end = close + 1;
    }

    // consume immediately-following {...} groups (braces may nest)
    let groups = 0;
    while (text[end] === "{" && groups < 4) {
      const close = matchBraceGroup(text, end);
      if (close === -1) break;
      end = close + 1;
      groups++;
    }

    // consume a directly-glued trailing sub/superscript: \sqrt{2}^2, x_{...}
    while (text[end] === "^" || text[end] === "_") {
      end += 1;
      if (text[end] === "{") {
        const close = matchBraceGroup(text, end);
        if (close === -1) break;
        end = close + 1;
      } else if (/[a-zA-Z0-9]/.test(text[end] ?? "")) {
        end += 1;
      }
    }

    // fold in adjacent "+ \frac{...}", "- 3", etc. so chained expressions
    // become a single math block
    let extended = true;
    while (extended) {
      extended = false;
      const glue = /^\s*[+\-*/=]\s*/.exec(text.slice(end));
      if (!glue) break;
      const after = end + glue[0].length;
      const rest = text.slice(after);

      const nextCmd = new RegExp(
        `^\\\\(${BRACE_MATH_COMMANDS.join("|")})\\b`,
      ).exec(rest);
      const nextNum = /^[0-9]+(\.[0-9]+)?/.exec(rest);

      if (nextCmd) {
        let e2 = after + nextCmd[0].length;
        let g2 = 0;
        while (text[e2] === "{" && g2 < 4) {
          const close = matchBraceGroup(text, e2);
          if (close === -1) break;
          e2 = close + 1;
          g2++;
        }
        end = e2;
        extended = true;
      } else if (nextNum) {
        end = after + nextNum[0].length;
        extended = true;
      }
    }

    out += text.slice(cursor, start) + `$${text.slice(start, end)}$`;
    cursor = end;
    commandRe.lastIndex = end;
  }

  out += text.slice(cursor);
  return out;
}

/**
 * Normalizes OCR/text containing chemistry and math notation:
 * 1. Converts literal "\n" (two chars) into real newlines
 * 2. Converts invalid bare '^}' inside \ce to '\uparrow}'
 * 3. Normalizes 'ce{' (where leading backslash was stripped or omitted) to '\ce{'
 * 4. Fixes \ce immediately followed by formula without space/braces
 * 4b. Repairs display-math blocks with mismatched delimiter lengths (e.g. "$$...$")
 * 5. Cleans and normalizes display math ($$...$$ or $$...$$$), stripping any illegal inner $
 * 6. Protects valid math blocks and performs text-level fixes (wrapping bare \ce, \uparrow, chemical formulas)
 * 7. Adds a space after commas in plain text (skips numeric thousands separators)
 * 8. Wraps bare LaTeX commands like \frac{1}{3} that weren't inside $...$
 * 9. Upgrades \frac to \dfrac so fractions always render with adequate size
 */
function normalizeMathAndChemistry(text: string): string {
  if (!text) return text;
  let result = text;

  // 0a. Repair LaTeX commands corrupted by JSON escape sequence parsing:
  // - TAB (ASCII 9, \t) followed by letters: \text, \times, \theta, \tau, \to, \tan, \triangle, etc.
  result = result.replace(/\t([a-zA-Z])/g, "\\t$1");
  // - Form feed (ASCII 12, \f) followed by letters: \frac, \forall
  result = result.replace(/\x0c([a-zA-Z])/g, "\\f$1");
  // - Backspace (ASCII 8, \b) followed by letters: \beta, \bar, \binom, \mathbf, \bullet
  result = result.replace(/\x08([a-zA-Z])/g, "\\b$1");
  // - Carriage return (ASCII 13, \r) followed by letters: \rho, \right, \rightarrow, \rangle
  result = result.replace(/\r([a-zA-Z])/g, "\\r$1");
  // - Newline (ASCII 10, \n) followed by LaTeX math commands starting with \n (e.g. \neq, \nabla, \neg, \notin, \nu, \natural)
  result = result.replace(
    /\n(eq|e|abla|atural|eg|i|otin|ot|u|exists|rightarrow|leftarrow|Rightarrow|Leftarrow|mid|parallel|subset|subseteq|supset|supseteq|cong|sim)\b/g,
    "\\n$1",
  );

  // 0b. Repair bare 'ext{' inside or outside math that lost its leading '\t' or '\':
  // e.g. "ext{conc } ext{H}_2" -> "\text{conc } \text{H}_2"
  result = result.replace(/(^|[^\\])\bext\{/g, "$1\\text{");

  // 0c. Convert literal "\n" escape sequences (from JSON/OCR output) into real newlines,
  // BUT PRESERVE LaTeX commands starting with \n (like \neq, \nabla, \neg, \nu, \notin, \natural, \ne, \not, etc.)
  const LATEX_N_MACROS =
    /\\n(?!(?:eq|e|abla|atural|eg|i|otin|ot|u|exists|rightarrow|leftarrow|Rightarrow|Leftarrow|mid|parallel|subset|subseteq|supset|supseteq|cong|sim)\b)/g;
  const NEWLINE_PLACEHOLDER = "\u0000BSNL\u0000";
  result = result.replace(/\\\\n/g, NEWLINE_PLACEHOLDER);
  result = result.replace(LATEX_N_MACROS, "\n");
  result = result.replace(/\u0000BSNL\u0000/g, "\\\\n");

  // 1. Replace bare '^}' or '^ }' inside formulas with '\uparrow}' to prevent KaTeX parse errors
  result = result.replace(/\^\s*\}/g, "\\uparrow}");

  // 2. Normalize 'ce{' (where leading backslash was stripped or omitted) to '\ce{'
  result = result.replace(/(^|[^\\a-zA-Z0-9])ce\{/g, "$1\\ce{");

  // 3. Fix \ce immediately followed by letters/numbers without space or brace
  // e.g. \ceC2H5OH+3O2->2CO2+3H2O  =>  \ce{C2H5OH+3O2->2CO2+3H2O}
  // MUST have leading backslash \ce to avoid corrupting English words like "central" or "cell"
  result = result.replace(
    /\\ce(?![{\s])([A-Za-z0-9_+\-=>^]+)/g,
    (_, formula) => {
      return `\\ce{${formula}}`;
    },
  );

  // 4. Fix missing opening $$ when there's an unmatched trailing $$ after a formula
  // E.g. "... as follows: NH_3 <\ce{N2H4}<\ce{N2H2}<\ce{N3H}$$. So..."
  result = result.replace(
    /(:\s*)([A-Za-z0-9_\\{}<>=+\-\s]+?\\ce\{[^}]+\}(?:[A-Za-z0-9_\\{}<>=+\-\s]*))\$\$/g,
    (_, prefix, formula) => `${prefix}\n\n$$${formula.trim()}$$\n\n`,
  );

  // 4b. NEW: repair a display-math block whose delimiters don't match in
  // length — e.g. opens with "$$" but only a single "$" closes it (a dropped
  // closing dollar sign), or the mirror case (opens "$", closes "$$").
  //
  // Why this matters: math delimiters work like backtick code-spans — the
  // closing run must be the SAME LENGTH as the opening run. A "$$...$" block
  // doesn't just render with a stray character; remark-math can't match the
  // delimiters at all and gives up on treating it as math entirely, so the
  // whole thing (backslashes and all) shows up as literal text on screen.
  //
  // Guard against false positives: only touch a span if its content contains
  // a backslash (a LaTeX command). Plain prose that happens to mention a
  // dollar amount twice on one line ("costs $5 ... fee is $$10") never
  // contains a "\", so it's left completely alone. The content group also
  // excludes further "$"/newline so this never reaches across into a
  // separate, unrelated math span later in the same text.
  result = result.replace(
    /\$\$([^$\n]*\\[^$\n]*)\$(?!\$)/g,
    (_, inner) => `$$${inner}$$`,
  );
  result = result.replace(
    /(^|[^$])\$([^$\n]*\\[^$\n]*)\$\$/g,
    (_, before, inner) => `${before}$$${inner}$$`,
  );

  // 5. Clean display math blocks: $$ ... $$ or $$ ... $$$
  // Inside display math:
  // - Any inner '$' (e.g. '$\ce{...}$' or '$\text{...}$') is illegal in LaTeX math mode and breaks KaTeX.
  // - Trailing $$$ is normalized to $$
  // - \frac is upgraded to \dfrac
  result = result.replace(/\$\$([\s\S]+?)\${2,3}/g, (_, inner) => {
    const cleanInner = inner
      .replace(/\$([^$]*)\$/g, "$1")
      .replace(/\$/g, "")
      .replace(/\\frac\b/g, "\\dfrac")
      .trim();
    return `\n\n$$${cleanInner}$$\n\n`;
  });

  // 6. Protect all existing valid math blocks ($$...$$ and $...$) so text-level passes don't touch them
  const mathBlocks: string[] = [];
  result = result.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g, (match) => {
    const upgraded = match.replace(/\\frac\b/g, "\\dfrac");
    const idx = mathBlocks.length;
    mathBlocks.push(upgraded);
    return `\u0000MATH_${idx}\u0000`;
  });

  // 7. Text-level fixes (OUTSIDE of math delimiters):
  // 7a. Strip any remaining stray $$
  result = result.replace(/\$\$/g, "");

  // 7b/7c. Wrap bare \ce{...} chemistry notation — both a lone \ce{...} and a
  // chained comparison like \ce{A} < \ce{B} < \ce{C} — in a SINGLE regex pass
  // using `*` (zero-or-more) rather than two separate passes.
  //
  // NOTE (fix): the previous two-pass version — "wrap chains" then separately
  // "wrap any remaining bare \ce{}" — double-wrapped chained comparisons: the
  // chain pass wrapped the whole "\ce{A}<\ce{B}" run in $...$, then the bare
  // pass matched each \ce{} *inside* that span again and wrapped it a SECOND
  // time, producing corrupted "$$\ce{A}$<$\ce{B}$$" that KaTeX can't parse.
  // A single pass with `*` handles a lone \ce{} and a chained run identically
  // in one shot, with no overlap.
  result = result.replace(
    /(\\ce\{[^}]+\}(?:\s*(?:<|>|=|<=|>=|->|<=>)\s*\\ce\{[^}]+\})*)/g,
    (m) => `$${m}$`,
  );

  // 7d. Wrap bare arrows in plain text (e.g. "acidity \uparrow s" -> "acidity $\uparrow$ s")
  result = result.replace(
    /(^|[^\$\\])\\(uparrow|downarrow|rightarrow|leftarrow)\b/g,
    "$1$\\$2$",
  );

  // 7e. Wrap bare \neq expressions in plain text if not already inside math
  result = result.replace(
    /(^|[^\$])([a-zA-Z0-9_|()]+\s*\\neq\s*[a-zA-Z0-9_|()]+)(?=[^\$]|$)/g,
    "$1$$$2$$",
  );
  result = result.replace(/(^|[^\$\\])\\neq\b/g, "$1$\\neq$");

  // 7f. Convert bare chemical formulas with subscripts outside math like C_6H_{14} or NH_3 or C_6H_5NH_2 into $\ce{...}$
  result = result.replace(
    /(^|[\s([<])([A-Z][a-z]?(?:_\d+|_\{\d+\})(?:[A-Z][a-z]?(?:_\d+|_\{\d+\}|[A-Za-z0-9])*)*)(?=[.,;:\s)\]>]|$)/g,
    (match, prefix, formula) => {
      const cleanFormula = formula
        .replace(/_(\d+)/g, "$1")
        .replace(/_\{(\d+)\}/g, "$1");
      return `${prefix}$\\ce{${cleanFormula}}$`;
    },
  );

  // 7g. NEW: ensure a space follows every comma in plain text, e.g.
  // "a,b,c" -> "a, b, c". Skips commas that already have trailing whitespace
  // (no double-spacing) and skips a comma directly between two digits
  // ("12,000", "1,234,567", "{1,2,3}") so numeric thousands separators and
  // digit lists are left untouched. Uses a replace callback that only peeks
  // at each comma's immediate neighbors (not a consuming digit-pair regex),
  // so back-to-back single-digit commas like "1,2,3" are each judged
  // independently instead of the first match "eating" the shared digit.
  // Runs on text only — math/chemistry content is still placeholder-protected
  // from step 6, so a comma inside \binom{n}{k}, a coordinate pair, or a
  // $\ce{}$ formula is never touched by this step.
  result = result.replace(/,(?!\s)/g, (match, offset: number, str: string) => {
    const before = str[offset - 1];
    const after = str[offset + 1];
    const isNumericSeparator =
      !!before && !!after && /\d/.test(before) && /\d/.test(after);
    return isNumericSeparator ? "," : ", ";
  });

  // 7h. Wrap bare LaTeX commands with brace args (\frac{1}{3}, \sqrt{9}, ...)
  // that were left outside $...$. Runs last among the text-level fixes since
  // it doesn't interact with \ce{}/arrows/neq/commas, and by this point every
  // remaining backslash-command in `result` is guaranteed to be outside a
  // real math block (those were placeholder-protected in step 6).
  result = wrapBareLatexCommands(result);

  // 8. Restore protected math blocks
  result = result.replace(
    /\u0000MATH_(\d+)\u0000/g,
    (_, idx) => mathBlocks[Number(idx)],
  );

  // 9. Clean up excessive consecutive newlines introduced by block math formatting
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return result;
}

function MathRenderer({
  content,
  isDisplay,
}: {
  content: string;
  isDisplay: boolean;
}) {
  const html = useMemo(() => {
    try {
      // Force \frac -> \dfrac and strip any rogue inner $ in the raw LaTeX content
      let upgraded = content
        .replace(/\$([^$]*)\$/g, "$1")
        .replace(/\$/g, "")
        .replace(/\\frac\b/g, "\\dfrac");

      // Defense-in-depth: repair tab-corrupted commands and bare ext{
      upgraded = upgraded
        .replace(/\t([a-zA-Z])/g, "\\t$1")
        .replace(/(^|[^\\])\bext\{/g, "$1\\text{");

      return katex.renderToString(upgraded, {
        displayMode: isDisplay,
        throwOnError: false,
        errorColor: "#ef4444",
        // Security hardening (no behavior change for normal math/chemistry
        // content): blocks \href/\includegraphics-style trust-gated commands
        // so untrusted OCR text can't be used to inject links or resources.
        trust: false,
        // Reduces noisy console warnings on OCR text mixed with stray
        // unicode/whitespace inside math mode; doesn't affect rendered output.
        strict: false,
      });
    } catch {
      return null;
    }
  }, [content, isDisplay]);

  if (!html) {
    return <code>{content}</code>;
  }

  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      className={isDisplay ? "katex-display-block" : "katex-inline-block"}
    />
  );
}

/**
 * Shared markdown + KaTeX + mhchem renderer.
 *
 * Single source of truth for rendering mixed content — used for both
 * question text and option text. Uses the direct katex instance with mhchem
 * loaded, avoiding third-party module isolation issues.
 */
function RichContentBase({ text, className }: RichContentProps) {
  const remarkPlugins = useMemo(() => [remarkMath, remarkBreaks], []);

  const formattedContent = useMemo(() => {
    try {
      return normalizeMathAndChemistry(text);
    } catch (err) {
      // Fail open: render the raw text rather than crash the question view
      // on an unexpected OCR edge case.
      // eslint-disable-next-line no-console
      console.error(
        "RichContent: normalization failed, rendering raw text",
        err,
      );
      return text;
    }
  }, [text]);

  const components = useMemo(
    () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      code({ className: codeClassName, children, node, ...props }: any) {
        const textVal = String(children).replace(/\n$/, "");
        const isMath =
          codeClassName?.includes("language-math") ||
          codeClassName?.includes("math-inline") ||
          codeClassName?.includes("math-display") ||
          node?.type === "inlineMath" ||
          node?.type === "math";

        if (isMath) {
          const isDisplay =
            codeClassName?.includes("math-display") || node?.type === "math";
          return <MathRenderer content={textVal} isDisplay={!!isDisplay} />;
        }

        return (
          <code className={codeClassName} {...props}>
            {children}
          </code>
        );
      },
    }),
    [],
  );

  if (!text) {
    return null;
  }

  return (
    <div className={["rich-content", className].filter(Boolean).join(" ")}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={components as any}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Custom comparator: only re-render when `text` actually changes.
 */
export const RichContent = React.memo(RichContentBase, (prev, next) => {
  return prev.text === next.text && prev.className === next.className;
});

RichContent.displayName = "RichContent";
