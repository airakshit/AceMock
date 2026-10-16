/**
 * Scope ↔ hierarchy coupling shared by every mock-test search surface (the
 * student lists and the admin console).
 *
 * A test's scope and the curriculum levels it stores are the same fact: an
 * IOE Model test has no subject at all, a ChapterWise test carries all three
 * ids. These rules keep the two filter levels from ever disagreeing — the
 * type tags decide which hierarchy rows exist, and picking a hierarchy level
 * moves the type tag to match it.
 */

/** The four fields both search surfaces share. */
export interface MockTestScopeFilters {
  scope: string;
  subjectId: string;
  sectionId: string;
  chapterId: string;
}

/**
 * Level-2 (subject → section → chapter) filters exist only under the *Wise
 * scopes. "All" (""), IOE Model and Miscellaneous store no curriculum ids,
 * so their rows never show — and `applyMockTestFilterChange` clears any
 * picks when the tag moves there, so nothing is filtered invisibly.
 */
export function isHierarchyScope(scope: string): boolean {
  return scope === "subject" || scope === "section" || scope === "chapter";
}

/**
 * Next filter state after one field changed. Pure — callers keep any extra
 * fields of their own (e.g. the admin's `byAdmin`) via the generic.
 */
export function applyMockTestFilterChange<T extends MockTestScopeFilters>(
  prev: T,
  key: string,
  value: string,
): T {
  // Work on a concrete 4-field snapshot so the rules below read on plain
  // strings, then merge back over `prev` so extra fields survive.
  const next: MockTestScopeFilters = {
    ...prev,
    [key]: value,
  };

  // Picking a parent invalidates every child filter below it.
  if (key === "subjectId") {
    next.sectionId = "";
    next.chapterId = "";
  } else if (key === "sectionId") {
    next.chapterId = "";
  }

  if (key === "subjectId" || key === "sectionId" || key === "chapterId") {
    // Selecting a level moves the type tag to it — a chapter pick means
    // ChapterWise, a subject pick means SubjectWise — so the two levels
    // never disagree. Clearing a level leaves the tag alone rather than
    // silently undoing an explicit choice; "Clear" resets both together.
    if (value) {
      next.scope = next.chapterId
        ? "chapter"
        : next.sectionId
          ? "section"
          : "subject";
    }
  } else if (key === "scope") {
    // The reverse direction: a type only stores the levels at or above it,
    // so picking a shallower type trims the deeper picks rather than
    // leaving a combination that could never match a row. All / IOE Model /
    // Miscellaneous hide the hierarchy rows entirely — trim everything, or
    // a cleared-by-UI level would keep filtering invisibly.
    if (value === "" || value === "ioe_model" || value === "miscellaneous") {
      next.subjectId = "";
      next.sectionId = "";
      next.chapterId = "";
    } else if (value === "subject") {
      next.sectionId = "";
      next.chapterId = "";
    } else if (value === "section") {
      next.chapterId = "";
    }
  }

  return { ...prev, ...next };
}
