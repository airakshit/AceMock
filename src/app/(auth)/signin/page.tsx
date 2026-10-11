"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AuthHero } from "@/features/auth/components/AuthHero";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { ContinueWithGoogle } from "@/features/auth/components/ContinueWithGoogle";
import { OrDivider } from "@/features/auth/components/OrDivider";
import { SignInForm } from "@/features/auth/components/SignInForm";
import { AuthSwitchLink } from "@/features/auth/components/AuthSwitchLink";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("tab") === "signup") {
      router.replace("/signup");
    }
  }, [router, searchParams]);

  return (
    <div className="flex flex-col gap-6">
      <AuthHero variant="signin" />

      <AuthCard>
        <ContinueWithGoogle callbackURL="/dashboard" />
        <OrDivider label="or continue with email" />
        <SignInForm onSuccess={() => router.push("/dashboard")} callbackURL="/dashboard" />
        <AuthSwitchLink prompt="Don't have an account?" linkText="Create one" href="/signup" />
      </AuthCard>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-32 items-center justify-center">
          <div className="size-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}