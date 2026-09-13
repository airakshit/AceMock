"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import katex from "katex";

// ── mhchem setup ────────────────────────────────────────────────────────────
// mhchem mutates a global `katex` object to register the \ce{} macro. We must
// assign globalThis.katex BEFORE importing the extension, and rehype-katex
// must resolve to the SAME `katex` package instance (single install, no
// duplicate versions in node_modules) so the \ce{} macro is visible to it.
if (typeof globalThis !== "undefined") {
  (globalThis as Record<string, unknown>).katex = katex;
}
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";

export interface RichContentProps {
  /** Raw OCR / markdown text with embedded LaTeX ($...$, $$...$$, \ce{}) */
  text: string;
  /** Additional classes to apply to the wrapper */
  className?: string;
}

/* ============================================================================
 * NORMALIZATION PIPELINE
 *
 * Fixes malformed OCR/JSON-sourced text so remark-math + rehype-katex can
 * render it. Each stage is a small, pure, independently testable function.
 * Stages run in a fixed order — see `normalizeMathAndChemistry` at the end.
 * ==========================================================================*/

/** LaTeX commands that take brace-delimited arguments (\frac{1}{3}, \sqrt{2}, ...).
 *  Anything on this list found OUTSIDE $...$/$$...$$ delimiters gets auto-wrapped.
 *  Extend this list as new OCR patterns show up. */
const BRACE_MATH_COMMANDS = [
  "dfrac", "tfrac", "cfrac", "frac",
  "sqrt", "binom", "dbinom", "tbinom",
  "overline", "underline", "widehat", "widetilde",
  "vec", "hat", "bar", "dot", "ddot",
  "sum", "prod", "int", "oint", "iint", "iiint",
  "lim", "limsup", "liminf",
] as const;

// ---------------------------------------------------------------------------
// Stage 0: repair control-character corruption from JSON/OCR escape parsing.
// A JSON string containing "\t", "\f", "\b", "\r", "\n" followed by letters
// gets parsed into a literal TAB/FF/BS/CR/LF + letters, destroying LaTeX
// commands like \text, \frac, \beta, \right, \neq.
// ---------------------------------------------------------------------------
function repairEscapeSequences(text: string): string {
  let result = text;

  result = result.replace(/\t([a-zA-Z])/g, "\\t$1");   // \text, \times, \theta, \to...
  result = result.replace(/\x0c([a-zA-Z])/g, "\\f$1"); // \frac, \forall
  result = result.replace(/\x08([a-zA-Z])/g, "\\b$1"); // \beta, \bar, \binom, \mathbf
  result = result.replace(/\r([a-zA-Z])/g, "\\r$1");   // \rho, \right, \rightarrow

  // Newline + LaTeX \n-macros (\neq, \nabla, \neg, \notin, \nu, ...).
  // Everything else starting with \n after a real linebreak is left as a
  // linebreak (handled below) rather than folded into a fake macro.
  const N_MACRO_NAMES =
    "eq|e|abla|atural|eg|i|otin|ot|u|exists|rightarrow|leftarrow|" +
    "Rightarrow|Leftarrow|mid|parallel|subset|subseteq|supset|supseteq|cong|sim";
  result = result.replace(new RegExp(`\\n(${N_MACRO_NAMES})\\b`, "g"), "\\n$1");

  // Bare "ext{" that lost its leading "\t"/"\": ext{conc} -> \text{conc}
  result = result.replace(/(^|[^\\])\bext\{/g, "$1\\text{");

  // Literal two-character "\n" (from JSON) -> real newline, EXCEPT when it's
  // actually one of the LaTeX \n-macros above.
  const LATEX_N_MACROS = new RegExp(`\\\\n(?!(?:${N_MACRO_NAMES})\\b)`, "g");
  const NEWLINE_PLACEHOLDER = "\u0000BSNL\u0000";
  result = result.replace(/\\\\n/g, NEWLINE_PLACEHOLDER); // protect escaped \\n first
  result = result.replace(LATEX_N_MACROS, "\n");
  result = result.replace(/\u0000BSNL\u0000/g, "\\\\n");

  return result;
}

// ---------------------------------------------------------------------------
// Stage 1: repair chemistry-notation corruption (mhchem \ce{} blocks).
// ---------------------------------------------------------------------------
function repairChemistryNotation(text: string): string {
  let result = text;

  // Bare '^}' -> '\uparrow}' (common OCR mangling of an up-arrow before a brace)
  result = result.replace(/\^\s*\}/g, "\\uparrow}");

  // 'ce{' missing its leading backslash -> '\ce{'
  result = result.replace(/(^|[^\\a-zA-Z0-9])ce\{/g, "$1\\ce{");

  // '\ceC2H5OH+3O2->2CO2+3H2O' (missing braces) -> '\ce{C2H5OH+3O2->2CO2+3H2O}'
  result = result.replace(
    /\\ce(?![{\s])([A-Za-z0-9_+\-=>^]+)/g,
    (_m, formula: string) => `\\ce{${formula}}`,
  );

  return result;
}

// ---------------------------------------------------------------------------
// Stage 2: re-insert a missing opening "$$" when a formula ends in an
// orphaned trailing "$$", e.g. "as follows: \ce{N2H4}<\ce{N2H2}$$. So..."
// ---------------------------------------------------------------------------
function repairOrphanedDisplayMath(text: string): string {
  return text.replace(
    /(:\s*)([A-Za-z0-9_\\{}<>=+\-\s]+?\\ce\{[^}]+\}(?:[A-Za-z0-9_\\{}<>=+\-\s]*))\$\$/g,
    (_m, prefix: string, formula: string) => `${prefix}\n\n$$${formula.trim()}$$\n\n`,
  );
}

// ---------------------------------------------------------------------------
// Stage 3: clean display-math blocks ($$...$$ / $$...$$$).
// Inner "$" is illegal inside LaTeX math mode and breaks KaTeX; trailing
// "$$$" is normalized to "$$"; \frac is upgraded to \dfrac for legibility.
// ---------------------------------------------------------------------------
function cleanDisplayMathBlocks(text: string): string {
  return text.replace(/\$\$([\s\S]+?)\${2,3}/g, (_m, inner: string) => {
    const cleaned = inner
      .replace(/\$([^$]*)\$/g, "$1")
      .replace(/\$/g, "")
      .replace(/\\frac\b/g, "\\dfrac")
      .trim();
    return `\n\n$$${cleaned}$$\n\n`;
  });
}

// ---------------------------------------------------------------------------
// Stage 4: protect every already-valid math block so later text-level regex
// passes cannot corrupt it. Restored verbatim in the final stage.
// ---------------------------------------------------------------------------
function protectMathBlocks(text: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];
  const protectedText = text.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g, (match) => {
    const upgraded = match.replace(/\\frac\b/g, "\\dfrac");
    const idx = blocks.length;
    blocks.push(upgraded);
    return `\u0000MATH_${idx}\u0000`;
  });
  return { text: protectedText, blocks };
}

function restoreMathBlocks(text: string, blocks: string[]): string {
  return text.replace(/\u0000MATH_(\d+)\u0000/g, (_m, idx: string) => blocks[Number(idx)]);
}

// ---------------------------------------------------------------------------
// Brace-matching helper: given str[openIdx] === '{', returns the index of the
// matching '}' (handling nesting), or -1 if unmatched. Needed because JS
// regex cannot match arbitrarily-nested braces on its own.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Stage 5 (text-level, math already protected): wrap bare LaTeX commands
// that take brace arguments — e.g. a stray "\frac{1}{3}" typed/OCR'd outside
// any $...$ — into "$\frac{1}{3}$" so remark-math/rehype-katex render it.
//
// Greedily extends the wrapped span across "glued" +,-,*,/,= operators and
// chained commands/numbers so "\frac{1}{2}+\frac{1}{3}" becomes ONE math
// block instead of two adjacent ones. This is a heuristic, not a full LaTeX
// parser — good enough for typical OCR'd expressions.
// ---------------------------------------------------------------------------
function wrapBareLatexCommands(text: string): string {
  const commandRe = new RegExp(`\\\\(${BRACE_MATH_COMMANDS.join("|")})\\b`, "g");
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

      const nextCmd = new RegExp(`^\\\\(${BRACE_MATH_COMMANDS.join("|")})\\b`).exec(rest);
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

// ---------------------------------------------------------------------------
// Stage 6 (text-level): wrap bare \ce{} chemistry notation.
//
// IMPORTANT: this uses a single regex with `*` (zero-or-more) rather than two
// separate passes ("wrap chains" then "wrap any remaining bare \ce{}"). Two
// passes double-wraps chained comparisons — the chain pass wraps the whole
// "\ce{A}<\ce{B}" run in $...$, then a second bare-\ce{} pass matches each
// \ce{} *inside* that span again and wraps it a second time, producing
// corrupted "$$\ce{A}$<$\ce{B}$$". A single pass with `*` handles a lone
// \ce{} and a chained run identically, in one shot, with no overlap.
// ---------------------------------------------------------------------------
function applyChemistryTextFixes(text: string): string {
  return text.replace(
    /(\\ce\{[^}]+\}(?:\s*(?:<|>|=|<=|>=|->|<=>)\s*\\ce\{[^}]+\})*)/g,
    (m) => `$${m}$`,
  );
}

// ---------------------------------------------------------------------------
// Stage 7 (text-level): wrap bare symbols/formulas that OCR left un-delimited.
// ---------------------------------------------------------------------------
function applySymbolTextFixes(text: string): string {
  let result = text;

  // Strip any stray leftover "$$"
  result = result.replace(/\$\$/g, "");

  // Bare arrows: "acidity \uparrow s" -> "acidity $\uparrow$ s"
  result = result.replace(/(^|[^$\\])\\(uparrow|downarrow|rightarrow|leftarrow)\b/g, "$1$\\$2$");

  // Bare \neq expressions
  result = result.replace(/(^|[^$])([a-zA-Z0-9_|()]+\s*\\neq\s*[a-zA-Z0-9_|()]+)(?=[^$]|$)/g, "$1$$$2$$");
  result = result.replace(/(^|[^$\\])\\neq\b/g, "$1$\\neq$");

  // Bare chemical formulas with subscripts, e.g. NH_3, C_6H_{14} -> $\ce{NH3}$
  result = result.replace(
    /(^|[\s([<])([A-Z][a-z]?(?:_\d+|_\{\d+\})(?:[A-Z][a-z]?(?:_\d+|_\{\d+\}|[A-Za-z0-9])*)*)(?=[.,;:\s)\]>]|$)/g,
    (_m, prefix: string, formula: string) => {
      const clean = formula.replace(/_(\d+)/g, "$1").replace(/_\{(\d+)\}/g, "$1");
      return `${prefix}$\\ce{${clean}}$`;
    },
  );

  return result;
}

// ---------------------------------------------------------------------------
// Stage 8: collapse excess blank lines introduced by earlier stages.
// ---------------------------------------------------------------------------
function collapseWhitespace(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Full normalization pipeline. Pure function: same input -> same output.
 * Safe to unit test stage-by-stage (each helper above is independently
 * exported-shaped and testable if you re-export them from this module).
 */
export function normalizeMathAndChemistry(text: string): string {
  if (!text) return text;

  let result = text;
  result = repairEscapeSequences(result);
  result = repairChemistryNotation(result);
  result = repairOrphanedDisplayMath(result);
  result = cleanDisplayMathBlocks(result);

  const { text: protectedText, blocks } = protectMathBlocks(result);
  let working = protectedText;
  working = applyChemistryTextFixes(working);
  working = applySymbolTextFixes(working);
  working = wrapBareLatexCommands(working);

  result = restoreMathBlocks(working, blocks);
  result = collapseWhitespace(result);
  return result;
}

/* ============================================================================
 * RENDERING
 * remark-math parses $...$/$$...$$ into math AST nodes; rehype-katex converts
 * those nodes directly to KaTeX HTML in the rehype phase. No custom `code`
 * component interception needed — inline vs. display math is handled
 * automatically by the plugin.
 * ==========================================================================*/

// KaTeX options — single source of truth, applied once at the plugin level.
// `trust: false` (default) and `strict: false` are set explicitly:
//  - trust:false blocks \href/\includegraphics-style commands (XSS surface).
//  - strict:false silences noisy warnings on OCR text mixed with unicode.
const KATEX_OPTIONS = {
  throwOnError: false,
  strict: false,
  trust: false,
  errorColor: "#ef4444",
} as const;

// Defined once at module scope — never recreated per render.
const REMARK_PLUGINS = [remarkMath, remarkBreaks];
const REHYPE_PLUGINS: Array<[typeof rehypeKatex, typeof KATEX_OPTIONS]> = [
  [rehypeKatex, KATEX_OPTIONS],
];

function RichContentBase({ text, className }: RichContentProps) {
  const formattedContent = useMemo(() => {
    try {
      return normalizeMathAndChemistry(text);
    } catch (err) {
      // Fail open: render the raw text rather than crash the question view.
      // eslint-disable-next-line no-console
      console.error("RichContent: normalization failed, rendering raw text", err);
      return text;
    }
  }, [text]);

  if (!text) {
    return null;
  }

  return (
    <div className={["rich-content", className].filter(Boolean).join(" ")}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS as never}>
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
}

/** Only re-render when `text` or `className` actually change. */
export const RichContent = React.memo(RichContentBase, (prev, next) => {
  return prev.text === next.text && prev.className === next.className;
});

RichContent.displayName = "RichContent";