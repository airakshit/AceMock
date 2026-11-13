/**
 * Pure, dependency-free helpers for the v3 PATH-BASED entity identity.
 *
 * A path is the chain of verbatim printed labels from the top of the
 * document hierarchy down to an entity, e.g. ["4", "ii"] = parent question 4,
 * sub-question (ii). Labels are NEVER rewritten into numbers — but for
 * MATCHING across stages/pages they are canonicalized lightly:
 * surrounding parens/brackets, trailing dots/colons and padding are
 * stripped, case is folded. Roman "ii" and arabic "2" remain distinct
 * kinds (they usually denote different nesting levels).
 *
 * No imports: this module must stay safe for any tool to use.
 */

/** Strips decoration the printer put around a label: "(ii)", "[2]", "4.", "Q.7)"… */
export function canonicalizeSegment(raw: string): string {
  return raw
    .trim()
    .replace(/^[\(\[\{]+/, "")
    .replace(/[\)\]\}\.:,]+\s*$/, "")
    .trim()
    // Common question-marker prefixes printed before the number:
    // "Q.7", "Q7", "Question 4".
    .replace(/^(?:question|ques|q)\b[\.\:\s]*/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Canonical identity key of a path (stable join key across stages, pages,
 * figures and answer rows). Empty/missing paths share the "" key — that's
 * the "unlabeled continuation entity" slot, and callers MUST treat it as
 * at-most-one-entity-per-page (ambiguity is a hard error).
 */
export function pathKey(path: string[] | null | undefined): string {
  const segments = (path ?? []).map(canonicalizeSegment).filter(Boolean);
  return JSON.stringify(segments);
}

export type PathKey = string;

/**
 * Synthetic one-segment path addressing the page-TOP continuation FRAGMENT
 * (startState.obj), whose content carries no printed path. Stage 2 boxes
 * for such a fragment are keyed under this slot; the stitcher re-binds them
 * to the paired item's real path after the merge. The "@" prefix cannot
 * collide with a printed label (a printed segment is never "@"-prefixed
 * after canonicalization).
 */
export const START_FRAGMENT_SLOT = "@start";

/** Parses a pathKey back into its canonical segments. */
export function segmentsFromKey(key: PathKey): string[] {
  try {
    const parsed = JSON.parse(key);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === "string");
    }
  } catch {
    // fall through
  }
  return [];
}

export function samePath(
  a: string[] | null | undefined,
  b: string[] | null | undefined,
): boolean {
  return pathKey(a) === pathKey(b);
}

/** True when `prefix` is an ancestor chain of `full` (both canonical). */
export function isPrefixPath(
  prefix: string[] | null | undefined,
  full: string[] | null | undefined,
): boolean {
  const p = segmentsFromKey(pathKey(prefix));
  const f = segmentsFromKey(pathKey(full));
  if (p.length === 0) return false;
  if (p.length > f.length) return false;
  return p.every((segment, index) => segment === f[index]);
}

/** True when the canonical chain of `child` is exactly `parent` + one segment. */
export function isDirectChildPath(
  parent: string[] | null | undefined,
  child: string[] | null | undefined,
): boolean {
  const p = segmentsFromKey(pathKey(parent));
  const c = segmentsFromKey(pathKey(child));
  return c.length === p.length + 1 && isPrefixPath(p, c);
}

/**
 * Builds the ancestor-extended path for an entity whose page printed only a
 * visible suffix. The suffix's overlapping trailing
 * segments with `ancestorContext` are expected NOT to overlap — the context
 * provides the missing ancestors.
 *
 * Returns null when the two clearly conflict (first printed segment already
 * exists in the ancestor chain at a different depth) — caller then keeps the
 * printed path as-is and flags for review instead of fabricating a path.
 */
export function extendPath(
  ancestorContext: string[] | null | undefined,
  visibleSuffix: string[] | null | undefined,
): string[] | null {
  const base = segmentsFromKey(pathKey(ancestorContext));
  const suffixSegments = (visibleSuffix ?? [])
    .map(canonicalizeSegment)
    .filter(Boolean);
  if (suffixSegments.length === 0) return null;

  // A suffix that re-prints its full chain IS a complete path.
  if (suffixSegments.length > base.length) return suffixSegments;

  // The suffix must not duplicate a segment already at some level of base.
  if (suffixSegments.some((segment) => base.includes(segment))) return null;

  return [...base, ...suffixSegments];
}

/**
 * Inherit resolution for a page that prints only the tail of a label chain
 * (visibleSuffix only printed on the page). Returns the fully-extended path, or null when no
 * confident interpretation exists.
 *
 * Hypotheses, in order:
 *  1. SIBLING/CONTINUATION — the suffix advances the deepest visible level
 *     of the base. `("4","i")` then a page printing "(ii)" -> ["4","ii"].
 *     The resulting last two segments must keep their sequence sane
 *     (same kind, increasing value, i.e. ii > i) — otherwise rejected.
 *  2. COMPLETE RE-PRINT — the suffix is itself a full path beginning a new
 *     top-level item ("5" printed after ["4","ii"]) — accepted only when
 *     the top-level label plainly advances (same kind, increasing value).
 *  3. DEEPER SUFFIX — k>=2 printed segments are the deepest k levels under
 *     the base's trimmed ancestor chain.
 */
export function inheritPath(
  base: string[] | null | undefined,
  visibleSuffix: string[] | null | undefined,
): string[] | null {
  const baseSegments = segmentsFromKey(pathKey(base));
  const suffixSegments = (visibleSuffix ?? [])
    .map(canonicalizeSegment)
    .filter(Boolean);
  if (suffixSegments.length === 0 || baseSegments.length === 0) return null;

  const suffixKind = labelKind(suffixSegments[0]);

  // Hypothesis 2: suffix is a complete path that starts a NEW item.
  if (
    suffixSegments.length <= baseSegments.length &&
    labelKind(baseSegments[0]) === suffixKind
  ) {
    const baseValue = labelValue(baseSegments[0]);
    const suffixValue = labelValue(suffixSegments[0]);
    if (baseValue !== null && suffixValue !== null && suffixValue > baseValue) {
      return suffixSegments;
    }
  }

  if (suffixSegments.length === 1) {
    // Hypothesis 1: single printed segment = sibling of base's last label.
    const baseLast = baseSegments[baseSegments.length - 1];
    if (labelKind(baseLast) === suffixKind) {
      const baseValue = labelValue(baseLast);
      const suffixValue = labelValue(suffixSegments[0]);
      if (
        baseValue !== null &&
        suffixValue !== null &&
        suffixValue > baseValue
      ) {
        return [...baseSegments.slice(0, -1), suffixSegments[0]];
      }
      // Same label re-printed (or regressed) — the label looks re-printed
      // in full; if it equals the base's last segment treat as continuation
      // WITH the base unchanged.
      if (baseValue !== null && suffixValue === baseValue) {
        return [...baseSegments];
      }
    }
    return null;
  }

  // Hypothesis 3: deeper suffix — trimmed ancestor chain + suffix.
  const ancestors = baseSegments.slice(0, baseSegments.length - suffixSegments.length + 1);
  if (ancestors.length === 0) return null;
  if (suffixSegments.some((segment) => ancestors.includes(segment))) return null;
  return [...ancestors, ...suffixSegments];
}

// ---------------------------------------------------------------------------
// Label kind detection & sequence reasoning (for continuation sanity checks)
// ---------------------------------------------------------------------------

export type LabelKind =
  | "arabic"
  | "lowerRoman"
  | "upperRoman"
  | "lowerAlpha"
  | "upperAlpha"
  | "other";

export function labelKind(segment: string): LabelKind {
  const raw = segment.trim();
  if (/^\d+$/.test(raw)) return "arabic";
  const folded = canonicalizeSegment(segment);
  if (!folded) return "other";
  if (/^[ivxlcdm]+$/i.test(folded)) {
    // Single letters that are far more likely alphabetic sub-question labels
    // (c, d, l, m) than roman numerals; i/v/x sequences are treated as roman.
    const isUpper =
      raw === raw.toUpperCase() && /[A-Z]/.test(raw) ? true : false;
    if (folded.length >= 2 || "ivx".includes(folded)) {
      return isUpper ? "upperRoman" : "lowerRoman";
    }
    return isUpper ? "upperAlpha" : "lowerAlpha";
  }
  if (/^[a-z]$/.test(folded)) {
    if (/^[A-Z]$/.test(raw)) return "upperAlpha";
    return "lowerAlpha";
  }
  if (/^[A-Z]$/.test(raw)) return "upperAlpha";
  return "other";
}

const ROMAN_VALUES: Record<string, number> = {
  i: 1,
  v: 5,
  x: 10,
  l: 50,
  c: 100,
  d: 500,
  m: 1000,
};

export function labelValue(segment: string): number | null {
  const s = canonicalizeSegment(segment);
  const kind = labelKind(s);
  if (kind === "arabic") {
    const value = parseInt(s, 10);
    return Number.isFinite(value) ? value : null;
  }
  if (kind === "lowerRoman" || kind === "upperRoman") {
    const lower = s.toLowerCase();
    let total = 0;
    for (let i = 0; i < lower.length; i++) {
      const current = ROMAN_VALUES[lower[i]];
      const next = ROMAN_VALUES[lower[i + 1]] ?? 0;
      total += current < next ? -current : current;
    }
    return total > 0 && total < 4000 ? total : null;
  }
  if (kind === "lowerAlpha" || kind === "upperAlpha") {
    return s.charCodeAt(0) - 96;
  }
  return null;
}

const ROMAN_NUMERALS: [number, string][] = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
];

export function romanLabel(value: number, upper = false): string | null {
  if (value <= 0 || value >= 4000) return null;
  let remaining = value;
  let out = "";
  for (const [numeralValue, numeral] of ROMAN_NUMERALS) {
    while (remaining >= numeralValue) {
      out += numeral;
      remaining -= numeralValue;
    }
  }
  return upper ? out.toUpperCase() : out;
}

/** Suggests the label for `value` in the same style as `referenceSegment`. */
export function labelInKind(referenceSegment: string, value: number): string | null {
  const kind = labelKind(referenceSegment);
  switch (kind) {
    case "arabic":
      return String(value);
    case "lowerRoman":
      return romanLabel(value, false);
    case "upperRoman":
      return romanLabel(value, true);
    case "lowerAlpha":
      return value >= 1 && value <= 26 ? String.fromCharCode(96 + value) : null;
    case "upperAlpha":
      return value >= 1 && value <= 26 ? String.fromCharCode(64 + value) : null;
    default:
      return null;
  }
}

export { canonicalizeSegment as canonicalLabel };

/**
 * Human-readable display of a path: "4", "4(ii)", "4(ii)b".
 */
export function formatPathDisplay(path: string[] | null | undefined): string {
  const segments = (path ?? []).map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return "";
  const [first, ...rest] = segments;
  return `${first}${rest.map((s) => `(${s})`).join("")}`;
}

/**
 * Sanitizes path segments for use inside a storage filename.
 * Only [a-z0-9-] survive; empty/ambiguous segments become "x".
 */
export function segmentsForFilename(
  path: string[] | null | undefined,
): string {
  const cleaned = (path ?? [])
    .map((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12))
    .filter(Boolean);
  if (cleaned.length === 0) return "unlabeled";
  return cleaned.join("-").slice(0, 80) || "unlabeled";
}