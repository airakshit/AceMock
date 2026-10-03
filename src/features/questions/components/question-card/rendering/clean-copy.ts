"use client";

/**
 * Clean copy for rendered (KaTeX) rich content.
 *
 * KaTeX renders every formula twice: a visually hidden MathML mirror
 * (`.katex-mathml`) and the visible glyph tree (`.katex-html`, split
 * across table-like `vlist` spans). The browser's default HTML→text
 * copy serialization includes BOTH, so copying a question produced
 * mangled output like:
 *
 *     5.3 g of NaX
 *     2          ← subscript split onto its own line
 *     ​          ← zero-width artifacts
 *     COX
 *     3
 *     250 cc
 *     250 cc     ← duplicated by the MathML mirror
 *     A
 *     0.1 N
 *     0.1 N      ← duplicated
 *
 * This module intercepts `copy`/`cut` while the selection touches a
 * registered rich-content root and writes a clean plain-text payload to
 * the clipboard instead:
 *
 * - prose is copied as-is,
 * - every formula becomes its LaTeX source (`$...$` inline,
 *   `$$...$$` for display math) read from KaTeX's `application/x-tex`
 *   annotation,
 * - option rows collapse to `A. <content>` instead of badge/text on
 *   separate lines,
 * - zero-width characters are stripped and whitespace is tidied.
 *
 * A CSS rule in globals.css also keeps the MathML mirror out of
 * selections, so even copies that bypass this handler stay readable.
 */

/** Rich-content roots that currently want clean copying. */
const copyRoots = new Set<HTMLElement>();
let listening = false;

/** Zero-width characters that should never survive into the clipboard. */
const ZERO_WIDTH_RE = /[\u200B-\u200D\u2060\uFEFF]/g;

/** Tags that start a new line when serialized. */
const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "details",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "tbody",
  "tfoot",
  "thead",
  "tr",
  "ul",
]);

/** Non-content elements that contribute nothing to copied text. */
const NON_TEXT_TAGS = new Set([
  "svg",
  "style",
  "script",
  "noscript",
  "template",
  "iframe",
]);

/** True for elements that own their own text selection (skip them). */
function isFormControl(el: Element): boolean {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el as HTMLElement).isContentEditable === true
  );
}

/**
 * Given a node inside a formula, returns the element the copied range
 * should expand to so whole formulas are copied — the `.katex-display`
 * wrapper for display math, the `.katex` element otherwise.
 */
function findFormulaBoundary(node: Node): Element | null {
  let el: Element | null =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

  while (el) {
    if (el.classList.contains("katex")) {
      return el.closest(".katex-display") ?? el;
    }
    if (el.classList.contains("katex-display")) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/** The formula's LaTeX source, from KaTeX's MathML annotation. */
function latexSource(formula: Element): string | null {
  const annotation = formula.querySelector(
    'annotation[encoding="application/x-tex"]',
  );
  const source = annotation?.textContent?.trim();
  return source ? source : null;
}

/** Fallback when a formula somehow has no annotation: visible glyphs. */
function visibleMathText(formula: Element): string {
  return (
    formula.querySelector(".katex-html")?.textContent ??
    formula.textContent ??
    ""
  );
}

function serializeChildren(el: Element, fromIndex = 0): string {
  let out = "";
  for (let i = fromIndex; i < el.children.length; i++) {
    out += serializeNode(el.children[i]);
  }
  return out;
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as Element;
  const tag = el.localName;

  if (tag === "br") return "\n";
  if (NON_TEXT_TAGS.has(tag)) return "";
  // Decorative/icon-only text (checkmarks, sr-only labels, hidden icons).
  if (el.classList.contains("sr-only")) return "";
  if (el.getAttribute("aria-hidden") === "true") return "";

  // Display math → $$latex$$ on its own line; inline math → $latex$.
  // Never serialize the duplicated MathML/glyph trees.
  if (el.classList.contains("katex-display")) {
    const source = latexSource(el);
    return source ? `\n$$${source}$$\n` : serializeChildren(el);
  }
  if (el.classList.contains("katex")) {
    const source = latexSource(el);
    return source ? `$${source}$` : visibleMathText(el);
  }

  // Option rows (OptionsList): children[0] is the A/B/C/D badge. Copy as
  // "A. <content>" rather than badge and text landing on separate lines.
  if (el.getAttribute("role") === "radio") {
    const badge = el.children[0]?.textContent?.trim() ?? "";
    if (/^[A-D]$/.test(badge)) {
      const content = serializeChildren(el, 1).trim();
      return `${badge}. ${content}\n`;
    }
  }

  if (BLOCK_TAGS.has(tag)) return serializeChildren(el) + "\n";
  return serializeChildren(el);
}

/** Strip artifacts and tidy whitespace in the assembled copy text. */
function sanitizeCopyText(text: string): string {
  return text
    .replace(ZERO_WIDTH_RE, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Serialize the selection as clean text. Boundaries that land inside a
 * formula are first pulled out to the formula's edge, so a drag across
 * the middle of a formula still copies the whole `$...$` source instead
 * of a half-cloned subtree.
 */
function buildCopyText(range: Range): string {
  const expanded = range.cloneRange();

  const startFormula = findFormulaBoundary(expanded.startContainer);
  if (startFormula) expanded.setStartBefore(startFormula);
  const endFormula = findFormulaBoundary(expanded.endContainer);
  if (endFormula) expanded.setEndAfter(endFormula);

  const fragment = expanded.cloneContents();
  let out = "";
  for (const child of Array.from(fragment.childNodes)) {
    out += serializeNode(child);
  }
  return sanitizeCopyText(out);
}

function handleCopy(event: Event) {
  const target = event.target;
  // Inputs/textareas/contenteditable manage their own selection.
  if (target instanceof Element && isFormControl(target)) return;

  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return;
  }
  const range = selection.getRangeAt(0);

  // Only take over when the selection touches registered rich content;
  // everything else (app inputs, other pages) keeps default behavior.
  let touchesRichContent = false;
  for (const root of copyRoots) {
    if (root.isConnected && range.intersectsNode(root)) {
      touchesRichContent = true;
      break;
    }
  }
  if (!touchesRichContent) return;

  const clipboardData = (event as ClipboardEvent).clipboardData;
  if (!clipboardData) return;

  event.preventDefault();
  clipboardData.setData("text/plain", buildCopyText(range));
}

/**
 * Register a rich-content root for clean copying. Returns its
 * unregister function (pass to `useEffect` cleanup). The document-level
 * `copy`/`cut` listener is attached while at least one root exists.
 */
export function registerCopyRoot(root: HTMLElement | null): () => void {
  if (!root) return () => undefined;

  copyRoots.add(root);
  if (!listening) {
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCopy);
    listening = true;
  }

  return () => {
    copyRoots.delete(root);
    if (copyRoots.size === 0 && listening) {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCopy);
      listening = false;
    }
  };
}
