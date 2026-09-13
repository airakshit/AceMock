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
 * 4. Fixes \ce or ce immediately followed by formula without space/braces
 * 5. Auto-wraps \ce{...} in $...$ if not already inside math delimiters
 * 6. Replaces \frac with \dfrac so fractions always render in display style
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

  // 1. Replace bare '^}' or '^ }' inside formulas with '\uparrow}' to prevent KaTeX superscript parse errors
  result = result.replace(/\^\s*\}/g, "\\uparrow}");

  // 2. Normalize 'ce{' (where leading backslash was stripped or omitted) to '\ce{'
  result = result.replace(/(^|[^\\a-zA-Z0-9])ce\{/g, "$1\\ce{");

  // 3. Fix \ce or ce immediately followed by letters/numbers without space or brace
  // e.g. \ceC2H5OH+3O2->2CO2+3H2O  =>  \ce{C2H5OH+3O2->2CO2+3H2O}
  result = result.replace(/(?:\\ce|(?<=\s|^)ce)(?![{\s])([A-Za-z0-9_+\-=>\s^]+)/g, (_, formula) => {
    return `\\ce{${formula}}`;
  });

  // 4. Auto-wrap \ce{...} in $...$ if not already inside $ or $$ math delimiters
  result = result.replace(/(^|[^$])(\\ce\{[^}]+\})/g, (_, prefix, cePart) => {
    return `${prefix}$${cePart}$`;
  });

  // 5. Replace \frac with \dfrac everywhere in math so fractions render full-size.
  //    This is the key fix: \dfrac forces "display" fraction style which prevents
  //    KaTeX from aggressively shrinking nested numerators/denominators.
  //    We only replace inside math delimiters to avoid mangling plain text.
  result = result.replace(/(\$\$?)([\s\S]*?)(\$\$?)/g, (match, open, inner, close) => {
    const replaced = inner.replace(/\\frac\b/g, "\\dfrac");
    return `${open}${replaced}${close}`;
  });

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
      // Force \frac -> \dfrac in the raw LaTeX content as well
      // (catches cases where remarkMath strips delimiters before we see them)
      const upgraded = content.replace(/\\frac\b/g, "\\dfrac");

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
