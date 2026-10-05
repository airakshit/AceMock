"use client";

import React, { useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import katex from "katex";

// Ensure globalThis.katex is assigned BEFORE the mhchem extension is loaded.
if (typeof globalThis !== "undefined") {
  (globalThis as Record<string, unknown>).katex = katex;
}
import "katex/contrib/mhchem";

import {
  normalizeMathAndChemistry,
  escapeUnsafeMathChars,
  wrapMultiDigitScripts,
  type NormalizeOptions,
} from "./latexNormalize";
import { registerCopyRoot } from "./clean-copy";

export interface RichContentProps {
  /** Raw OCR / markdown text with embedded LaTeX ($...$, $$...$$, \ce{}) */
  text: string;
  /** Additional Tailwind classes to apply to the wrapper */
  className?: string;
  /** Passed through to normalizeMathAndChemistry. See NormalizeOptions for
   * what each flag does. Most callers can leave this unset. */
  normalizeOptions?: NormalizeOptions;
}

// ---------------------------------------------------------------------------
// Math rendering
// ---------------------------------------------------------------------------

/**
 * Renders a single math span with KaTeX.
 *
 * This is the LAST line of defense for a math span, not just the first:
 * remark-math's mdast-util-math hands this component math content directly
 * for anything wrapped in $...$/$$...$$ that survived normalizeMathAndChemistry,
 * but ALSO for content the author fenced explicitly with ```math or
 * `math-inline` code spans — which never passes through
 * normalizeMathAndChemistry at all. So the same defensive fixes
 * (control-char repair, %/#/& escaping, un-braced script wrapping,
 * \frac -> \dfrac) are re-applied here, idempotently, right before render.
 */
function MathRenderer({
  content,
  isDisplay,
}: {
  content: string;
  isDisplay: boolean;
}) {
  const html = useMemo(() => {
    if (!content) return null;
    try {
      let upgraded = content
        .replace(/\$([^$]*)\$/g, "$1")
        .replace(/\$/g, "")
        .replace(/\\frac\b/g, "\\dfrac");

      // Repair tab/backspace/form-feed-corrupted commands and bare ext{}
      // that can still arrive here from a fenced ```math block that skipped
      // the main normalize pipeline entirely.
      upgraded = upgraded
        .replace(/\t([a-zA-Z])/g, "\\t$1")
        .replace(/(^|[^\\])\bext\{/g, "$1\\text{");

      const escapeAmpersand = !/\\begin\{/.test(upgraded);
      upgraded = escapeUnsafeMathChars(upgraded, { escapeAmpersand });
      upgraded = wrapMultiDigitScripts(upgraded);

      return katex.renderToString(upgraded, {
        displayMode: isDisplay,
        throwOnError: false,
        errorColor: "var(--danger)",
        // Security hardening (no behavior change for normal math/chemistry
        // content): blocks \href/\includegraphics-style trust-gated
        // commands so untrusted OCR text can't inject links or resources.
        trust: false,
        // Reduces noisy console warnings on OCR text mixed with stray
        // unicode/whitespace inside math mode; doesn't affect output.
        strict: false,
      });
    } catch {
      return null;
    }
  }, [content, isDisplay]);

  if (!html) {
    // KaTeX failed even with throwOnError: false suppressing most errors
    // (e.g. it threw before producing any markup at all). Show the raw
    // source rather than nothing, so a broken question is still legible
    // and debuggable instead of silently blank.
    return <code className="rich-content-math-fallback">{content}</code>;
  }

  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      className={isDisplay ? "katex-display-block" : "katex-inline-block"}
    />
  );
}

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------

/**
 * ReactMarkdown's remark/rehype pipeline can, on a sufficiently strange
 * mdast tree, throw during render rather than inside a try/catch we
 * control (normalizeMathAndChemistry and MathRenderer both guard their own
 * failure modes, but a crash in the markdown AST-to-React conversion
 * itself is outside either). Catching it here means one malformed question
 * degrades to plain text instead of white-screening the whole test.
 */
class RichContentErrorBoundary extends React.Component<
  { fallbackText: string; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallbackText: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("RichContent: markdown render failed", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <span className="rich-content-fallback">{this.props.fallbackText}</span>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Shared markdown + KaTeX + mhchem renderer
// ---------------------------------------------------------------------------

function RichContentBase({
  text,
  className,
  normalizeOptions,
}: RichContentProps) {
  const remarkPlugins = useMemo(() => [remarkMath, remarkBreaks], []);

  // Copying inside this content must yield clean text with formulas as
  // LaTeX source (see ./clean-copy.ts). Keyed on `text` because the root
  // div only exists while there is text to render.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => registerCopyRoot(rootRef.current), [text]);

  // normalizeOptions is a plain object; compare by value so callers can
  // pass an inline literal without defeating memoization.
  const normalizeKey = JSON.stringify(normalizeOptions ?? {});

  const formattedContent = useMemo(() => {
    if (!text) return text;
    try {
      return normalizeMathAndChemistry(text, normalizeOptions);
    } catch (err) {
      // Fail open: render the raw text rather than crash the question view
      // on an unexpected OCR edge case. (normalizeMathAndChemistry already
      // isolates its own internal stages, so this only catches something
      // truly unexpected — e.g. a bad options object.)
      console.error(
        "RichContent: normalization failed, rendering raw text",
        err,
      );
      return text;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, normalizeKey]);

  const components = useMemo(
    () => ({
      code({
        className: codeClassName,
        children,
        node,
        ...props
      }: React.ComponentPropsWithoutRef<"code"> & {
        node?: { type?: string };
      }) {
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
    <div ref={rootRef} className={["rich-content", className].filter(Boolean).join(" ")}>
      <RichContentErrorBoundary fallbackText={text}>
        <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
          {formattedContent}
        </ReactMarkdown>
      </RichContentErrorBoundary>
    </div>
  );
}

/** Custom comparator: only re-render when props actually changed. */
export const RichContent = React.memo(RichContentBase, (prev, next) => {
  return (
    prev.text === next.text &&
    prev.className === next.className &&
    JSON.stringify(prev.normalizeOptions ?? {}) ===
      JSON.stringify(next.normalizeOptions ?? {})
  );
});

RichContent.displayName = "RichContent";
