"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
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
 * 1. Converts invalid bare '^}' inside \ce to '\uparrow}'
 * 2. Normalizes 'ce{' (where leading backslash was stripped or omitted) to '\ce{'
 * 3. Fixes \ce or ce immediately followed by formula without space/braces (e.g. \ceC2H5OH... -> \ce{C2H5OH...})
 * 4. Auto-wraps \ce{...} in $...$ if not already inside math delimiters
 */
function normalizeMathAndChemistry(text: string): string {
  if (!text) return text;
  let result = text;

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
      return katex.renderToString(content, {
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
      className={isDisplay ? "katex-display my-2 block overflow-x-auto" : "katex-inline"}
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
  const remarkPlugins = useMemo(() => [remarkMath], []);

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
        "prose prose-sm dark:prose-invert max-w-none",
        "[&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden",
        "[&_.katex-display]:py-1 [&_.katex-display]:px-0.5",
        "[&_p]:my-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
