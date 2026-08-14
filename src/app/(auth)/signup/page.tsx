"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import {
    AuthCard,
    AuthHeader,
    AuthSwitchLink,
} from "@/components/patterns/auth-card";
import { OrDivider } from "@/components/patterns/or-divider";
import { ContinueWithGoogle } from "@/features/auth/components/ContinueWithGoogle";
import { SignUpForm } from "@/features/auth/components/SignUpForm";

function SignUpContent() {
    const router = useRouter();

    return (
        <AuthCard>
            <AuthHeader title="Sign up" />

            <AuthSwitchLink
                prompt="Already have an account?"
                linkText="Log in"
                href="/signin"
            />

            <ContinueWithGoogle callbackURL="/dashboard" />

            <OrDivider />

            <SignUpForm
                onSuccess={() => router.push("/dashboard")}
                callbackURL="/dashboard"
            />
        </AuthCard>
    );
}

export default function SignUpPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-32 items-center justify-center">
                    <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            }
        >
            <SignUpContent />
        </Suspense>
    );
}
