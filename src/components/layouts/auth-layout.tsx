import { cn } from "@/lib/utils";
import { layout } from "@/lib/design-system";

interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className={cn(layout.pageShell, "relative min-h-screen bg-background justify-center", className)}>
      {/* Subtle micro grid */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:20px_20px] opacity-50"
        aria-hidden="true"
      />

      <div className={cn(layout.pageContainer, "relative z-10")}>
        {children}
      </div>
    </div>
  );
}
