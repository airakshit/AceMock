import { cn } from "@/lib/utils";
import { AuthBrandPanel } from "@/components/layouts/components/AuthBrandPanel";

interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div
      className={cn(
        "relative grid h-svh overflow-hidden lg:grid-cols-[1.05fr_1fr]",
        className,
      )}
    >
      {/* Brand canvas — full-bleed background on small screens, grid panel on large */}
      <AuthBrandPanel />

      {/* Form column — transparent over the panel on mobile, plain canvas on desktop */}
      <div className="relative z-10 flex min-h-0 flex-col overflow-hidden lg:bg-background">
        {/* Decorative glow — anchored to the column, outside the scroll area */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
        >
          <div className="absolute -top-32 right-0 hidden size-96 rounded-full bg-emerald-500/8 blur-3xl lg:block" />
          <div className="absolute -bottom-48 -left-24 hidden size-80 rounded-full bg-emerald-600/6 blur-3xl lg:block" />
        </div>

        {/* Centered middle — perfectly centered when content fits; only scrolls when it truly can't */}
        <div className="relative z-10 flex min-h-0 flex-1 justify-center overflow-y-auto">
          <div className="m-auto w-full max-w-(--auth-card-max-width) px-5 py-4 sm:px-8">
            {children}
          </div>
        </div>

        {/* Bottom tagline — small screens only */}
        <p className="relative z-10 shrink-0 px-5 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[11px] font-medium tracking-wide text-sidebar-foreground/75 lg:hidden">
          Practice sharper · Score higher
        </p>
      </div>
    </div>
  );
}
