import Link from "next/link";
import { cn } from "@/lib/utils";
import { layout } from "@/lib/design-system";
import { typography } from "@/lib/design-system";

interface AuthCardProps {
    children: React.ReactNode;
    className?: string;
}

export function AuthCard({ children, className }: AuthCardProps) {
    return (
        <div
            className={cn(
                layout.stack,
                "rounded-xl border border-border bg-card p-6 shadow-sm",
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
    className?: string;
}

export function AuthHeader({ title, description, className }: AuthHeaderProps) {
    return (
        <header className={cn("space-y-1.5 text-center", className)}>
            <h1 className={typography.display}>{title}</h1>
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
        <p className={cn(typography.bodyMuted, "text-center", className)}>
            {prompt}{" "}
            <Link href={href} className={typography.link}>
                {linkText}
            </Link>
        </p>
    );
}
