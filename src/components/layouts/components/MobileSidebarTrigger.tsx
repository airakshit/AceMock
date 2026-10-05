"use client";

import { usePathname } from "next/navigation";

import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * MobileSidebarTrigger — the floating menu button that replaces the sidebar
 * opener that used to live in the (now removed) sticky header.
 *
 * Small screens only: desktop keeps the persistent icon rail. It floats at
 * the top-left so navigation stays reachable while page content (title,
 * description, lists) scrolls underneath, and it hides on attempt/review
 * routes — focus-mode screens that carry their own exit control.
 */
export function MobileSidebarTrigger() {
  const pathname = usePathname();

  const isFocusMode =
    pathname.endsWith("/attempt") || pathname.startsWith("/mocks/review");

  if (isFocusMode) {
    return null;
  }

  return (
    <SidebarTrigger
      aria-label="Open navigation menu"
      className="fixed top-3 left-3 z-40 size-9 rounded-lg border border-border/70 bg-background/85 text-foreground shadow-card backdrop-blur-md md:hidden"
    />
  );
}
