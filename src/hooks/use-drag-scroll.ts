"use client";

import { useEffect, useState } from "react";

/** Pixels of travel before a press-and-move counts as a drag, not a click. */
const DRAG_THRESHOLD_PX = 4;

/**
 * useDragScroll — lets users pan a horizontally scrollable container by
 * pressing and dragging with a mouse, the way a trackpad or finger already
 * behaves on touch devices.
 *
 * Attach the returned ref callback to the scroll container; listeners are
 * managed in an effect for the lifetime of that element. Mouse pointers only
 * — touch input is left entirely to native scrolling — and a press that
 * travels less than the drag threshold falls through as a normal click, so
 * chips and buttons inside the row keep working (no pointer capture is ever
 * taken, which would retarget the trailing click to the container).
 *
 * While a drag is live the class `drag-scrolling` sits on the container (for
 * a grabbing cursor), and the click that terminates a real drag is swallowed
 * in the capture phase so it never selects the chip you released over.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const [element, setElement] = useState<T | null>(null);

  useEffect(() => {
    const el = element;
    if (!el) return;

    // Mutable drag bookkeeping, scoped to this element's listeners.
    let pressed = false;
    let pointerId: number | null = null;
    let startX = 0;
    let startScrollLeft = 0;
    let dragged = false;

    // Arrow consts (not hoisted function declarations) so the `el` narrowing
    // above is preserved inside their bodies.
    const handleMove = (event: PointerEvent) => {
      if (!pressed || event.pointerId !== pointerId) return;

      const delta = event.clientX - startX;
      if (!dragged && Math.abs(delta) < DRAG_THRESHOLD_PX) return;

      if (!dragged) {
        dragged = true;
        el.classList.add("drag-scrolling");
      }
      el.scrollLeft = startScrollLeft - delta;
    };

    const handleUp = (event: PointerEvent) => {
      if (!pressed || event.pointerId !== pointerId) return;

      pressed = false;
      pointerId = null;
      endTrack();
      el.classList.remove("drag-scrolling");
      // `dragged` stays true so the trailing click can be swallowed below;
      // the next press resets it.
    };

    const handleDown = (event: PointerEvent) => {
      // Touch/pen already scroll natively; only mice need the drag.
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      // Nothing to pan — let the row behave like ordinary content.
      if (el.scrollWidth <= el.clientWidth) return;

      pressed = true;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScrollLeft = el.scrollLeft;
      dragged = false;
      beginTrack();
    };

    // The click fired by the press that ended a drag must not reach a chip —
    // swallow it once, in the capture phase, before it can select anything.
    const handleClickCapture = (event: MouseEvent) => {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    };

    function beginTrack() {
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleUp);
    }

    function endTrack() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    }

    el.addEventListener("pointerdown", handleDown);
    // Capture phase so a post-drag click never bubbles to a chip handler.
    el.addEventListener("click", handleClickCapture, true);

    return () => {
      el.removeEventListener("pointerdown", handleDown);
      el.removeEventListener("click", handleClickCapture, true);
      endTrack();
      el.classList.remove("drag-scrolling");
    };
  }, [element]);

  return setElement;
}
