/**
 * latexNormalize.ts
 *
 * Turns messy OCR'd / hand-typed exam content (mixed plain text, LaTeX math,
 * and mhchem chemistry) into markdown that remark-math + KaTeX can actually
 * parse.
 *
 * DESIGN
 * ------
 * The old version of this file was a single 150-line function with numbered
 * comments ("step 4b", "step 7g"...). It worked, but it had three structural
 * problems this version fixes:
 *
 *   1. ONE BAD STAGE COULD KILL ALL THE OTHERS.
 *      Everything ran inside one big `.replace()` chain with no isolation.
 *      A single stage throwing (or a regex catastrophically backtracking)
 *      meant the *whole* normalize call failed and the component fell back
 *      to fully raw, un-rendered text. Here, each stage runs in its own
 *      try/catch inside the pipeline runner: a broken stage is skipped and
 *      logged, everything else still applies.
 *
 *   2. PLACEHOLDER COLLISIONS.
 *      The old code protected math spans with a fixed marker
 *      ("\u0000MATH_0\u0000"). If OCR ever produced that exact byte
 *      sequence (copy-pasted from a previous bad run, for instance) the
 *      restore step would silently corrupt content. Placeholders are now
 *      keyed with a per-call random nonce, so this can't happen.
 *
 *   3. NO WAY TO TEST OR DEBUG A SINGLE RULE.
 *      Each transformation is now a small named, pure, exported function.
 *      You can unit test `wrapBareChemFormulas("NH_3 is a base")` in
 *      isolation, and `normalizeMathAndChemistry(text, { debug: true })`
 *      will console.debug the text after every stage that changed it.
 *
 * See LATEX_MISTAKES.md alongside this file for the catalogue of OCR/LaTeX
 * mistakes each stage is defending against.
 */

// ---------------------------------------------------------------------------
// Shared constants & primitives
// ---------------------------------------------------------------------------

/**
 * LaTeX commands that take brace-delimited arguments (\frac{1}{3}, \sqrt{2},
 * ...). Anything on this list found OUTSIDE $...$/$$...$$ delimiters gets
 * auto-wrapped by wrapBareLatexCommands(). Extend this list as new OCR
 * patterns show up.
 */
export const BRACE_MATH_COMMANDS = [
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

const BRACE_MATH_COMMAND_SOURCE = BRACE_MATH_COMMANDS.join("|");

/** Macros that legitimately start with "\n" and must survive the literal
 * "\n" -> newline conversion untouched (\neq, \nabla, ...). */
const LATEX_N_MACRO_EXCEPTIONS =
  "eq|e|abla|atural|eg|i|otin|ot|u|exists|rightarrow|leftarrow|Rightarrow|Leftarrow|mid|parallel|subset|subseteq|supset|supseteq|cong|sim";

/**
 * Brace-matching helper: given str[openIdx] === '{', returns the index of
 * the matching '}' (handling nesting, e.g. \frac{1}{\sqrt{2}}), or -1 if
 * unmatched. Needed because JS regex cannot match arbitrarily-nested braces
 * on its own.
 */
export function matchBraceGroup(str: string, openIdx: number): number {
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

/** Generates a per-call placeholder nonce so protected spans can never
 * collide with real content, however unlikely a fixed marker collision
 * would have been. */
function makeNonce(): string {
  return `\u0000${Math.random().toString(36).slice(2)}${Date.now().toString(36)}\u0000`;
}

// ---------------------------------------------------------------------------
// New: shared "make this math span actually parse" resolvers.
// These run both inside the pipeline (on $...$ / $$...$$ spans found in
// text) AND at render time in RichContent's MathRenderer (for math that
// arrives via fenced ```math blocks, which never pass through this file at
// all). Keep them pure and side-effect free so both call sites match.
// ---------------------------------------------------------------------------

/**
 * Escapes bare `%`, `#`, and (optionally) `&` inside a math span.
 *
 * Mistake this fixes: in LaTeX, `%` starts a comment that swallows the rest
 * of the line, `#` is a macro-parameter marker, and `&` is a column
 * separator valid only inside array-like environments (aligned, matrix,
 * cases...). Exam content routinely contains "% yield" or "A & B" inside
 * `$...$` without realizing these are reserved; KaTeX will either silently
 * truncate the expression or throw.
 *
 * `&` is only escaped when the span has no `\begin{...}` in it, since inside
 * a real aligned/matrix environment `&` is doing its actual job and must be
 * left alone.
 */
export function escapeUnsafeMathChars(
  span: string,
  opts: { escapeAmpersand: boolean },
): string {
  let out = span.replace(/(^|[^\\])%/g, "$1\\%");
  out = out.replace(/(^|[^\\])#/g, "$1\\#");
  if (opts.escapeAmpersand) {
    out = out.replace(/(^|[^\\])&/g, "$1\\&");
  }
  return out;
}

/**
 * Wraps un-braced multi-character sub/superscripts: `x_10` -> `x_{10}`,
 * `e^-23` -> `e^{-23}`.
 *
 * Mistake this fixes: `_` and `^` in LaTeX bind to exactly ONE following
 * token — a single character, or a `{...}` group. `x_10` is parsed as
 * "x with subscript 1" followed by a bare, normally-sized "0" — not the
 * "10" the author meant. This is one of the single most common OCR
 * mistakes in scientific content and silently produces wrong-looking
 * output rather than an error, so it's easy to miss in testing.
 *
 * Only touches digit runs (optionally signed): `x_a` (single letter) is
 * left alone since ambiguous multi-letter scripts (`x_max`) are better
 * fixed upstream with explicit `\text{}` than guessed at here.
 */
export function wrapMultiDigitScripts(span: string): string {
  return span.replace(/([_^])(-\d+|\d{2,})/g, "$1{$2}");
}

// ---------------------------------------------------------------------------
// Pipeline stages (each one small, named, and independently testable)
// ---------------------------------------------------------------------------

/**
 * Stage: repair LaTeX commands corrupted by upstream JSON/OCR escape
 * parsing, where a literal control character ate the backslash that should
 * have preceded a letter (\t -> TAB, \b -> backspace, \f -> form feed,
 * \r -> carriage return, \n -> newline).
 */
export function repairEscapeCorruption(text: string): string {
  let out = text;
  out = out.replace(/\t([a-zA-Z])/g, "\\t$1"); // \text, \times, \theta, \tau, \to, \tan, \triangle...
  out = out.replace(/\x0c([a-zA-Z])/g, "\\f$1"); // \frac, \forall
  out = out.replace(/\x08([a-zA-Z])/g, "\\b$1"); // \beta, \bar, \binom, \mathbf, \bullet
  out = out.replace(/\r([a-zA-Z])/g, "\\r$1"); // \rho, \right, \rightarrow, \rangle
  out = out.replace(
    new RegExp(`\\n(${LATEX_N_MACRO_EXCEPTIONS})\\b`, "g"),
    "\\n$1",
  );
  // bare 'ext{' that lost its leading '\t' or '\': "ext{conc }" -> "\text{conc }"
  out = out.replace(/(^|[^\\])\bext\{/g, "$1\\text{");
  return out;
}

/**
 * Stage: convert literal two-character "\n" escape sequences (from
 * JSON/OCR output) into real newlines, while preserving genuine LaTeX
 * macros that start with \n (\neq, \nabla, \neg, \nu, \notin, ...).
 */
export function restoreLiteralNewlines(text: string, nonce: string): string {
  const latexNMacroRe = new RegExp(
    `\\\\n(?!(?:${LATEX_N_MACRO_EXCEPTIONS})\\b)`,
    "g",
  );
  const placeholder = `${nonce}BSNL${nonce}`;
  let out = text.replace(/\\\\n/g, placeholder);
  out = out.replace(latexNMacroRe, "\n");
  out = out.replace(new RegExp(placeholder, "g"), "\\\\n");
  return out;
}

/** Stage: bare '^}' / '^ }' inside formulas -> '\uparrow}' (prevents a
 * KaTeX parse error on a dangling superscript marker). */
export function fixBareCaretBrace(text: string): string {
  return text.replace(/\^\s*\}/g, "\\uparrow}");
}

/** Stage: normalize 'ce{' (leading backslash stripped/omitted by OCR) to
 * '\ce{'. */
export function normalizeCeOpenBrace(text: string): string {
  return text.replace(/(^|[^\\a-zA-Z0-9])ce\{/g, "$1\\ce{");
}

/** Stage: fix \ce immediately followed by a formula with no space/brace,
 * e.g. \ceC2H5OH+3O2->2CO2+3H2O -> \ce{C2H5OH+3O2->2CO2+3H2O}. Requires the
 * leading backslash so English words like "central" or "cell" are never
 * touched. */
export function fixCeGluedFormula(text: string): string {
  return text.replace(
    /\\ce(?![{\s])([A-Za-z0-9_+\-=>^]+)/g,
    (_, formula) => `\\ce{${formula}}`,
  );
}

/** Stage: fix a missing opening $$ when a formula run ends in an unmatched
 * trailing $$. */
export function fixMissingOpeningDisplayDelims(text: string): string {
  return text.replace(
    /(:\s*)([A-Za-z0-9_\\{}<>=+\-\s]+?\\ce\{[^}]+\}(?:[A-Za-z0-9_\\{}<>=+\-\s]*))\$\$/g,
    (_, prefix, formula) => `${prefix}\n\n$$${formula.trim()}$$\n\n`,
  );
}

/**
 * Stage: repair a display-math block whose delimiters don't match in
 * length — e.g. opens "$$" but a dropped closing dollar leaves only a
 * single "$", or the mirror case (opens "$", closes "$$").
 *
 * Math delimiters work like backtick code-spans: the closing run must be
 * the same length as the opening run. A "$$...$" block isn't just rendered
 * with a stray character — remark-math can't match the delimiters at all,
 * so the entire span (backslashes included) shows up as literal text.
 *
 * Guarded to only touch spans containing a backslash, so plain prose that
 * mentions a dollar amount twice on one line ("costs $5 ... fee is $$10")
 * is left alone.
 */
export function repairMismatchedDisplayDelimLengths(text: string): string {
  let out = text.replace(
    /\$\$([^$\n]*\\[^$\n]*)\$(?!\$)/g,
    (_, inner) => `$$${inner}$$`,
  );
  out = out.replace(
    /(^|[^$])\$([^$\n]*\\[^$\n]*)\$\$/g,
    (_, before, inner) => `${before}$$${inner}$$`,
  );
  return out;
}

/**
 * Stage: clean display math blocks ($$...$$ or $$...$$$) — strip illegal
 * inner `$`, normalize a trailing $$$ to $$, and (optionally) upgrade
 * \frac to \dfrac so fractions render at full display size.
 */
export function cleanDisplayMathBlocks(
  text: string,
  upgradeFracToDfrac: boolean,
): string {
  return text.replace(/\$\$([\s\S]+?)\${2,3}/g, (_, inner) => {
    let cleanInner = inner.replace(/\$([^$]*)\$/g, "$1").replace(/\$/g, "");
    if (upgradeFracToDfrac) {
      cleanInner = cleanInner.replace(/\\frac\b/g, "\\dfrac");
    }
    return `\n\n$$${cleanInner.trim()}$$\n\n`;
  });
}

interface NormalizeContext {
  nonce: string;
  mathBlocks: string[];
}

/**
 * Stage: protect every valid math span ($$...$$ and $...$) behind a
 * placeholder so later text-level passes never touch real math, AND run
 * the "make this span actually parse" resolvers on the isolated content
 * (percent/hash/ampersand escaping, un-braced multi-digit scripts, \frac
 * upgrade). This is the single choke point all math passes through, so
 * every math span gets these fixes regardless of which earlier stage
 * produced it.
 */
export function protectMathBlocks(
  text: string,
  ctx: NormalizeContext,
  opts: { upgradeFracToDfrac: boolean; escapeAmpersand: boolean },
): string {
  return text.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g, (match) => {
    let span = match;
    if (opts.upgradeFracToDfrac) {
      span = span.replace(/\\frac\b/g, "\\dfrac");
    }
    span = escapeUnsafeMathChars(span, opts);
    span = wrapMultiDigitScripts(span);
    const idx = ctx.mathBlocks.length;
    ctx.mathBlocks.push(span);
    return `${ctx.nonce}MATH_${idx}${ctx.nonce}`;
  });
}

/** Stage: strip any stray "$$" left in plain text after math protection. */
export function stripStrayDoubleDollar(text: string): string {
  return text.replace(/\$\$/g, "");
}

/**
 * Stage: wrap bare \ce{...} chemistry notation in `$...$` — both a lone
 * \ce{...} and a chained comparison like \ce{A} < \ce{B} < \ce{C} — in a
 * single pass using `*` (zero-or-more), so a chain and a lone formula are
 * both handled with no risk of double-wrapping the inner \ce{} a second
 * time (which a two-pass "chain, then leftover" approach is prone to).
 */
export function wrapCeChains(text: string): string {
  return text.replace(
    /(\\ce\{[^}]+\}(?:\s*(?:<|>|=|<=|>=|->|<=>)\s*\\ce\{[^}]+\})*)/g,
    (m) => `$${m}$`,
  );
}

/** Stage: wrap bare arrow macros in plain text, e.g. "acidity \uparrow s"
 * -> "acidity $\uparrow$ s". */
export function wrapBareArrows(text: string): string {
  return text.replace(
    /(^|[^\$\\])\\(uparrow|downarrow|rightarrow|leftarrow)\b/g,
    "$1$\\$2$",
  );
}

/** Stage: wrap bare \neq comparisons and lone \neq macros left outside
 * math delimiters. */
export function wrapBareNeq(text: string): string {
  let out = text.replace(
    /(^|[^\$])([a-zA-Z0-9_|()]+\s*\\neq\s*[a-zA-Z0-9_|()]+)(?=[^\$]|$)/g,
    "$1$$$2$$",
  );
  out = out.replace(/(^|[^\$\\])\\neq\b/g, "$1$\\neq$");
  return out;
}

/** Stage: convert bare chemical formulas with subscripts outside math
 * (C_6H_{14}, NH_3, C_6H_5NH_2) into $\ce{...}$. */
export function wrapBareChemFormulas(text: string): string {
  return text.replace(
    /(^|[\s([<])([A-Z][a-z]?(?:_\d+|_\{\d+\})(?:[A-Z][a-z]?(?:_\d+|_\{\d+\}|[A-Za-z0-9])*)*)(?=[.,;:\s)\]>]|$)/g,
    (match, prefix, formula) => {
      const cleanFormula = formula
        .replace(/_(\d+)/g, "$1")
        .replace(/_\{(\d+)\}/g, "$1");
      return `${prefix}$\\ce{${cleanFormula}}$`;
    },
  );
}

/** Stage: ensure a space follows every comma in plain text ("a,b,c" ->
 * "a, b, c"), skipping commas that are numeric thousands separators
 * ("12,000") since math/chemistry content is already placeholder-protected
 * by this point. */
export function addSpaceAfterCommas(text: string): string {
  return text.replace(/,(?!\s)/g, (match, offset: number, str: string) => {
    const before = str[offset - 1];
    const after = str[offset + 1];
    const isNumericSeparator =
      !!before && !!after && /\d/.test(before) && /\d/.test(after);
    return isNumericSeparator ? "," : ", ";
  });
}

/**
 * Stage: wraps bare LaTeX commands that take brace arguments — e.g. a
 * stray "\frac{1}{3}" typed/OCR'd outside any $...$ — into "$\frac{1}{3}$"
 * so it actually renders instead of showing up as raw backslash text.
 *
 * Must run after math protection so every remaining "\command" found here
 * is guaranteed to be outside real math delimiters.
 *
 * Greedily extends the wrapped span across "glued" +,-,*,/,= operators and
 * chained commands/numbers so "\frac{1}{2}+\frac{1}{3}" becomes ONE math
 * block instead of two adjacent ones. This is a heuristic, not a full LaTeX
 * parser — good enough for typical OCR'd/typed expressions.
 */
export function wrapBareLatexCommands(text: string): string {
  const commandRe = new RegExp(`\\\\(${BRACE_MATH_COMMAND_SOURCE})\\b`, "g");
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

      const nextCmd = new RegExp(`^\\\\(${BRACE_MATH_COMMAND_SOURCE})\\b`).exec(
        rest,
      );
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

/** Stage: restore the protected math spans, now carrying their fixes. */
export function restoreMathBlocks(text: string, ctx: NormalizeContext): string {
  const re = new RegExp(`${ctx.nonce}MATH_(\\d+)${ctx.nonce}`, "g");
  return text.replace(re, (_, idx) => ctx.mathBlocks[Number(idx)] ?? "");
}

export function removeNestedMathDelimiters(text: string): string {
  return text.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g, (match) =>
    match.replace(/\\\(/g, "").replace(/\\\)/g, ""),
  );
}

/** Stage: collapse runs of 3+ newlines (introduced by block-math
 * formatting) down to a single blank line, and trim. */
export function collapseExcessNewlines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface NormalizeOptions {
  /** Upgrade \frac to \dfrac everywhere so fractions render at full size.
   * Default true (matches previous behavior). Turn off for contexts like a
   * dense multiple-choice option list where a smaller inline fraction is
   * preferable. */
  upgradeFracToDfrac?: boolean;
  /** Escape bare `&` inside math spans (it's a column separator, illegal
   * outside array/aligned/matrix environments). Default: true unless the
   * source text contains `\begin{`, in which case it's assumed to be a
   * real environment and left alone. Override explicitly if that heuristic
   * ever guesses wrong for your content. */
  escapeAmpersand?: boolean;
  /** Logs the text after every stage that actually changed it. Useful when
   * a specific piece of OCR content isn't rendering as expected. */
  debug?: boolean;
}

type Stage = [name: string, run: (text: string) => string];

/**
 * Normalizes OCR/typed text containing chemistry and math notation into
 * markdown remark-math + KaTeX can render. See the file header and
 * LATEX_MISTAKES.md for the full rationale.
 *
 * Each stage runs isolated: if one stage throws (a pathological input
 * tripping up a regex, for instance) it's skipped and logged rather than
 * discarding every other fix.
 */
export function normalizeMathAndChemistry(
  text: string,
  options: NormalizeOptions = {},
): string {
  if (!text) return text;

  const opts = {
    upgradeFracToDfrac: options.upgradeFracToDfrac ?? true,
    escapeAmpersand: options.escapeAmpersand ?? !/\\begin\{/.test(text),
    debug: options.debug ?? false,
  };

  const ctx: NormalizeContext = { nonce: makeNonce(), mathBlocks: [] };

  const stages: Stage[] = [
    ["repairEscapeCorruption", repairEscapeCorruption],
    ["restoreLiteralNewlines", (t) => restoreLiteralNewlines(t, ctx.nonce)],
    ["fixBareCaretBrace", fixBareCaretBrace],
    ["normalizeCeOpenBrace", normalizeCeOpenBrace],
    ["fixCeGluedFormula", fixCeGluedFormula],
    ["fixMissingOpeningDisplayDelims", fixMissingOpeningDisplayDelims],
    [
      "repairMismatchedDisplayDelimLengths",
      repairMismatchedDisplayDelimLengths,
    ],
    [
      "cleanDisplayMathBlocks",
      (t) => cleanDisplayMathBlocks(t, opts.upgradeFracToDfrac),
    ],

    ["removeNestedMathDelimiters", removeNestedMathDelimiters],

    ["protectMathBlocks", (t) => protectMathBlocks(t, ctx, opts)],
    ["stripStrayDoubleDollar", stripStrayDoubleDollar],
    ["wrapCeChains", wrapCeChains],
    ["wrapBareArrows", wrapBareArrows],
    ["wrapBareNeq", wrapBareNeq],
    ["wrapBareChemFormulas", wrapBareChemFormulas],
    ["addSpaceAfterCommas", addSpaceAfterCommas],
    ["wrapBareLatexCommands", wrapBareLatexCommands],
    ["restoreMathBlocks", (t) => restoreMathBlocks(t, ctx)],
    ["collapseExcessNewlines", collapseExcessNewlines],
  ];

  let result = text;
  for (const [name, run] of stages) {
    try {
      const next = run(result);
      if (opts.debug && next !== result) {
        // eslint-disable-next-line no-console
        console.debug(`[normalizeMathAndChemistry] ${name}:`, next);
      }
      result = next;
    } catch (err) {
      // A single stage failing must never take down the whole pipeline.
      // eslint-disable-next-line no-console
      console.error(`[normalizeMathAndChemistry] stage "${name}" failed`, err);
    }
  }

  return result;
}
