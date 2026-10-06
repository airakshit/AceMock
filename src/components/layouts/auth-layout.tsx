import { cn } from "@/lib/utils";
import { AuthBrandPanel } from "@/components/layouts/components/AuthBrandPanel";

interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className={cn("grid h-svh overflow-hidden lg:grid-cols-[1.05fr_1fr]", className)}>
      <AuthBrandPanel />

      {/* Form column */}
      <div className="relative flex items-center justify-center overflow-hidden bg-background px-5 py-6 sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-50 lg:hidden" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 right-0 hidden size-96 rounded-full bg-emerald-500/8 blur-3xl lg:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 -left-24 hidden size-80 rounded-full bg-emerald-600/6 blur-3xl lg:block"
        />
        <div className="relative z-10 w-full max-w-[var(--auth-card-max-width)]">
          {children}
        </div>
      </div>
    </div>
  );
}
