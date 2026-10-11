"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { AuthHero } from "@/features/auth/components/AuthHero";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { ContinueWithGoogle } from "@/features/auth/components/ContinueWithGoogle";
import { OrDivider } from "@/features/auth/components/OrDivider";
import { SignUpForm } from "@/features/auth/components/SignUpForm";
import { AuthSwitchLink } from "@/features/auth/components/AuthSwitchLink";

function SignUpContent() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <AuthHero variant="signup" />

      <AuthCard>
        <ContinueWithGoogle callbackURL="/dashboard" label="Sign up with Google" />
        <OrDivider label="or continue with email" />
        <SignUpForm onSuccess={() => router.push("/dashboard")} callbackURL="/dashboard" />
        <AuthSwitchLink prompt="Already have an account?" linkText="Sign in" href="/signin" />
      </AuthCard>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-32 items-center justify-center">
          <div className="size-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        </div>
      }
    >
      <SignUpContent />
    </Suspense>
  );
}