"use client";

import { useSearchParams } from "next/navigation";
import { SignUpForm } from "@/features/auth/components/SignUpForm";
import { ContinueWithGoogle } from "@/features/auth/components/ContinueWithGoogle";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export function SignUp() {
    const params = useSearchParams();

    return (
        <Card className="w-full max-w-xl mx-auto rounded-[2rem] border border-border/80 bg-card/90 shadow-[0_20px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-border/30 dark:bg-card/95">
            <CardHeader className="border-b border-border/70 px-6 py-6 dark:border-border/20">
                <div className="space-y-3">
                    <CardTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        Create your account
                    </CardTitle>
                    <CardDescription className="max-w-xl text-sm text-muted-foreground sm:text-base">
                        Enter your information to create an account.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6 sm:p-8">
                <SignUpForm params={params} callbackURL="/dashboard" />
                <ContinueWithGoogle
                    callbackURL="/dashboard"
                    label="Continue with Google"
                />
            </CardContent>
        </Card>
    );
}
