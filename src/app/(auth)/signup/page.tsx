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
            <AuthHeader
                title="Create your account"
                description="Start building smarter practice tests today."
            />

            <ContinueWithGoogle callbackURL="/dashboard" label="Sign up with Google" />

            <OrDivider label="or continue with email" />

            <SignUpForm
                onSuccess={() => router.push("/dashboard")}
                callbackURL="/dashboard"
            />

            <AuthSwitchLink
                prompt="Already have an account?"
                linkText="Log in"
                href="/signin"
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
