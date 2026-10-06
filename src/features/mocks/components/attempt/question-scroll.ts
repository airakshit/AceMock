import type { RefObject } from "react";

/** Nearest ancestor that actually scrolls, if any. */
function findScroller(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function smoothOrAuto(): ScrollBehavior {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

/**
 * Returns the question to the top after navigation.
 *
 * Desktop renders a fixed two-pane layout, so the question column itself
 * glides back; mobile uses natural page scroll, so the page container
 * glides instead. Each motion is skipped when already at the top, and the
 * navigator column never moves — it always rests on the same level.
 */
export function resetQuestionScroll(
  ref: RefObject<HTMLDivElement | null>,
): void {
  const el = ref.current;
  if (!el) return;
  const behavior = smoothOrAuto();

  // Question column (desktop two-pane; a no-op on mobile, where the column
  // grows naturally and never scrolls on its own).
  if (el.scrollTop > 0) {
    el.scrollTo({ top: 0, behavior });
  }

  // Page container (mobile natural scroll; a no-op on desktop, where the
  // page fits the viewport exactly and cannot scroll).
  const scroller = findScroller(el);
  if (scroller && scroller.scrollTop > 0) {
    scroller.scrollTo({ top: 0, behavior });
  }
}
