import { cn } from "@/lib/utils";
import { AuthBrandPanel } from "@/components/layouts/components/AuthBrandPanel";

interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className={cn("grid min-h-svh lg:grid-cols-[1.05fr_1fr]", className)}>
      <AuthBrandPanel />

      {/* Form column */}
      <div className="relative flex items-center justify-center bg-background px-5 py-10 sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-50 lg:hidden" />
        <div className="relative z-10 w-full max-w-[var(--auth-card-max-width)]">
          {children}
        </div>
      </div>
    </div>
  );
}
