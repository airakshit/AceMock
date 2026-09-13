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
 * Normalizes OCR/text containing chemistry and math notation:
 * 1. Converts literal "\n" (two chars) into real newlines
 * 2. Converts invalid bare '^}' inside \ce to '\uparrow}'
 * 3. Normalizes 'ce{' (where leading backslash was stripped or omitted) to '\ce{'
 * 4. Fixes \ce immediately followed by formula without space/braces
 * 5. Cleans and normalizes display math ($$...$$ or $$...$$$), stripping any illegal inner $
 * 6. Protects valid math blocks and performs text-level fixes (wrapping bare \ce, \uparrow, chemical formulas)
 * 7. Upgrades \frac to \dfrac so fractions always render with adequate size
 */
function normalizeMathAndChemistry(text: string): string {
  if (!text) return text;
  let result = text;

  // 0. Convert literal "\n" escape sequences (from JSON/OCR output) into real newlines.
  //    Protect "\\n" (an actual double-backslash followed by 'n' in the source) first.
  const NEWLINE_PLACEHOLDER = "\u0000BSNL\u0000";
  result = result.replace(/\\\\n/g, NEWLINE_PLACEHOLDER);
  result = result.replace(/\\n/g, "\n");
  result = result.replace(/\u0000BSNL\u0000/g, "\\\\n");

  // 1. Replace bare '^}' or '^ }' inside formulas with '\uparrow}' to prevent KaTeX parse errors
  result = result.replace(/\^\s*\}/g, "\\uparrow}");

  // 2. Normalize 'ce{' (where leading backslash was stripped or omitted) to '\ce{'
  result = result.replace(/(^|[^\\a-zA-Z0-9])ce\{/g, "$1\\ce{");

  // 3. Fix \ce immediately followed by letters/numbers without space or brace
  // e.g. \ceC2H5OH+3O2->2CO2+3H2O  =>  \ce{C2H5OH+3O2->2CO2+3H2O}
  // MUST have leading backslash \ce to avoid corrupting English words like "central" or "cell"
  result = result.replace(/\\ce(?![{\s])([A-Za-z0-9_+\-=>^]+)/g, (_, formula) => {
    return `\\ce{${formula}}`;
  });

  // 4. Fix missing opening $$ when there's an unmatched trailing $$ after a formula
  // E.g. "... as follows: NH_3 <\ce{N2H4}<\ce{N2H2}<\ce{N3H}$$. So..."
  result = result.replace(
    /(:\s*)([A-Za-z0-9_\\{}<>=+\-\s]+?\\ce\{[^}]+\}(?:[A-Za-z0-9_\\{}<>=+\-\s]*))\$\$/g,
    (_, prefix, formula) => `${prefix}\n\n$$${formula.trim()}$$\n\n`
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

  // 7b. Wrap chained comparisons of \ce: e.g. \ce{A} < \ce{B} < \ce{C} -> $\ce{A} < \ce{B} < \ce{C}$
  result = result.replace(/(\\ce\{[^}]+\}(?:\s*(?:<|>|=|<=|>=|->|<=>)\s*\\ce\{[^}]+\})+)/g, (match) => {
    return `$${match}$`;
  });

  // 7c. Wrap remaining bare \ce{...} in $...$
  result = result.replace(/(\\ce\{[^}]+\})/g, "$$$1$$");

  // 7d. Wrap bare arrows in plain text (e.g. "acidity \uparrow s" -> "acidity $\uparrow$ s")
  result = result.replace(/(^|[^\$\\])\\(uparrow|downarrow|rightarrow|leftarrow)\b/g, "$1$\\$2$");

  // 7e. Convert bare chemical formulas with subscripts outside math like C_6H_{14} or NH_3 or C_6H_5NH_2 into $\ce{...}$
  result = result.replace(
    /(^|[\s([<])([A-Z][a-z]?(?:_\d+|_\{\d+\})(?:[A-Z][a-z]?(?:_\d+|_\{\d+\}|[A-Za-z0-9])*)*)(?=[.,;:\s)\]>]|$)/g,
    (match, prefix, formula) => {
      const cleanFormula = formula.replace(/_(\d+)/g, "$1").replace(/_\{(\d+)\}/g, "$1");
      return `${prefix}$\\ce{${cleanFormula}}$`;
    }
  );

  // 8. Restore protected math blocks
  result = result.replace(/\u0000MATH_(\d+)\u0000/g, (_, idx) => mathBlocks[Number(idx)]);

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
      const upgraded = content
        .replace(/\$([^$]*)\$/g, "$1")
        .replace(/\$/g, "")
        .replace(/\\frac\b/g, "\\dfrac");

      return katex.renderToString(upgraded, {
        displayMode: isDisplay,
        throwOnError: false,
        errorColor: "#ef4444",
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

  const formattedContent = useMemo(() => normalizeMathAndChemistry(text), [text]);

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
    <div
      className={[
        "rich-content",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
