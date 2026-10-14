"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * AuthScrollArea — the centered, scrollable form area of the auth layout.
 *
 * The layout itself is shared across /signin and /signup, so this scroller's
 * DOM (and its scroll position) survives navigation between them. Keying it
 * by pathname remounts it on every route change, which resets the scroll to
 * zero — otherwise a page the user had scrolled (short viewports where the
 * form overflows) would hand its offset to the next page and land there
 * pushed to the top instead of centered.
 *
 * When content fits, `m-auto` centers it; when it overflows, scroll starts at
 * the top by design.
 */
export function AuthScrollArea({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className="relative z-10 flex min-h-0 flex-1 justify-center overflow-y-auto"
    >
      <div className="m-auto w-full max-w-(--auth-card-max-width) px-5 py-4 sm:px-8">
        {children}
      </div>
    </div>
  );
}
