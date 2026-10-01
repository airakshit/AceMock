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
        "rounded-2xl border border-border/80 bg-card p-6 shadow-card sm:p-8",
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
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm ring-1 ring-inset ring-white/20 lg:hidden">
          <Layers className="size-5" />
        </div>
      )}
      <h1
        data-page-title
        className={cn(typography.pageTitle, "text-xl font-bold tracking-tight")}
      >
        {title}
      </h1>
      {description ? (
        <p className={cn(typography.sectionSubtitle, "text-balance")}>
          {description}
        </p>
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
