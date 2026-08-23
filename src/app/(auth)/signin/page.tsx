"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthCard,
  AuthHeader,
  AuthSwitchLink,
} from "@/components/patterns/auth-card";
import { OrDivider } from "@/components/patterns/or-divider";
import { ContinueWithGoogle } from "@/features/auth/components/ContinueWithGoogle";
import { SignInForm } from "@/features/auth/components/SignInForm";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("tab") === "signup") {
      router.replace("/signup");
    }
  }, [router, searchParams]);

  return (
    <AuthCard>
      <AuthHeader title="Welcome back" />

      <AuthSwitchLink
        prompt="Don't have an account?"
        linkText="Sign up"
        href="/signup"
      />

      <ContinueWithGoogle callbackURL="/dashboard" />

      <OrDivider />

      <SignInForm
        onSuccess={() => router.push("/dashboard")}
        callbackURL="/dashboard"
      />
    </AuthCard>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-32 items-center justify-center">
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
