import Link from "next/link";
import { cn } from "@/lib/utils";
import { layout } from "@/lib/design-system";

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
        <header className={cn("space-y-1 text-center", className)}>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {title}
            </h1>
            {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
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
        <p className={cn("text-center text-sm text-muted-foreground", className)}>
            {prompt}{" "}
            <Link
                href={href}
                className="font-medium text-foreground underline-offset-4 hover:underline"
            >
                {linkText}
            </Link>
        </p>
    );
}
