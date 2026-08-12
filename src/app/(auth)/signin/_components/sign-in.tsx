"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SignInForm } from "@/features/auth/components/SignInForm";
import { ContinueWithGoogle } from "@/features/auth/components/ContinueWithGoogle";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function SignIn() {
    const router = useRouter();
    const params = useSearchParams();

    return (
        <Card className="w-full max-w-xl mx-auto overflow-hidden rounded-[2rem] border border-border/80 bg-card/90 shadow-[0_20px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-border/30 dark:bg-card/95">
            <CardHeader className="border-b border-border/70 px-6 py-6 dark:border-border/20">
                <div className="space-y-3">
                    <CardTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        Welcome back
                    </CardTitle>
                    <CardDescription className="max-w-xl text-sm text-muted-foreground sm:text-base">
                        Sign in with Google or your email and password to
                        continue.
                    </CardDescription>
                </div>
            </CardHeader>

            <CardContent className="space-y-6 p-6 sm:p-8">
                <div className="space-y-4 sm:space-y-5">
                    <SignInForm
                        params={params}
                        onSuccess={() => router.push("/dashboard")}
                        callbackURL="/dashboard"
                    />

                    <ContinueWithGoogle callbackURL="/dashboard" />
                </div>
            </CardContent>
        </Card>
    );
}
