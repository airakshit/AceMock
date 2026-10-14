import { cn } from "@/lib/utils";
import { AuthBrandPanel } from "@/components/layouts/components/AuthBrandPanel";
import { AuthScrollArea } from "@/components/layouts/components/AuthScrollArea";

interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div
      className={cn(
        // overflow-clip (not hidden): nothing here may become a scroll
        // container — a hidden-overflow box can still be scrolled by script
        // or scroll anchoring, which is what let navigation shove the whole
        // auth view to the top.
        "relative grid h-svh overflow-clip lg:grid-cols-[1.05fr_1fr]",
        className,
      )}
    >
      {/* Brand canvas — full-bleed background on small screens, grid panel on large */}
      <AuthBrandPanel />

      {/* Form column — transparent over the panel on mobile, plain canvas on desktop.
          overflow-clip (not hidden): this column must never become a scroll
          container — overflow:hidden still allows programmatic/anchoring
          scrolls, and the glow orbs used to give it scrollable overflow, so a
          navigation could silently shove the whole form to the top. Content
          scrolling belongs solely to the inner scroller below. */}
      <div className="relative z-10 flex min-h-0 flex-col overflow-clip lg:bg-background">
        {/* Decorative glow — anchored to the column, outside the scroll area.
            Clipped here so the orbs never add scrollable overflow upstream. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        >
          <div className="absolute -top-32 right-0 hidden size-96 rounded-full bg-emerald-500/8 blur-3xl lg:block" />
          <div className="absolute -bottom-48 -left-24 hidden size-80 rounded-full bg-emerald-600/6 blur-3xl lg:block" />
        </div>

        {/* Centered middle — perfectly centered when content fits; only scrolls when it truly can't.
            Remounts per route (keyed by pathname) so switching signin/signup always starts at 0. */}
        <AuthScrollArea>{children}</AuthScrollArea>

        {/* Bottom tagline — small screens only */}
        <p className="relative z-10 shrink-0 px-5 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[11px] font-medium tracking-wide text-sidebar-foreground/75 lg:hidden">
          Practice sharper · Score higher
        </p>
      </div>
    </div>
  );
}
