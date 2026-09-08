import Link from "next/link";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { layout, typography } from "@/lib/design-system";

interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        layout.stack,
        "rounded-xl border border-border bg-card p-6 shadow-xs sm:p-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface AuthHeaderProps {
  title: string;
  description?: string;
  showLogo?: boolean;
  className?: string;
}

export function AuthHeader({
  title,
  description,
  showLogo = true,
  className,
}: AuthHeaderProps) {
  return (
    <header className={cn("space-y-1.5 text-center", className)}>
      {showLogo && (
        <div className="mx-auto mb-2.5 flex size-9 items-center justify-center rounded-lg bg-foreground text-background shadow-2xs">
          <Layers className="size-4.5 text-background" />
        </div>
      )}
      <h1 data-page-title className={cn(typography.pageTitle, "text-xl font-bold tracking-tight")}>
        {title}
      </h1>
      {description ? (
        <p className={typography.sectionSubtitle}>{description}</p>
      ) : null}
    </header>
  );
}

interface AuthSwitchLinkProps {
  prompt: string;
  linkText: string;
  href: string;
  className?: string;
}

export function AuthSwitchLink({
  prompt,
  linkText,
  href,
  className,
}: AuthSwitchLinkProps) {
  return (
    <p className={cn(typography.bodyMuted, "text-center text-xs", className)}>
      {prompt}{" "}
      <Link href={href} className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors">
        {linkText}
      </Link>
    </p>
  );
}
