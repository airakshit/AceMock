import { cn } from "@/lib/utils";
import { layout } from "@/lib/design-system";

interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className={cn(layout.pageShell, className)}>
      <div className={layout.pageContainer}>{children}</div>
    </div>
  );
}
