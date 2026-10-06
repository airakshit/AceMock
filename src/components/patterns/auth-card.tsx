import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/icons/brand-logo";
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
        "rounded-2xl border border-border/80 bg-card p-5 shadow-card sm:p-6",
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
        <div className="mb-4 flex justify-center lg:hidden">
          <BrandLogo
            variant="full"
            size="md"
            tone="onLight"
            href="/dashboard"
          />
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
