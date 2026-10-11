"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Lock } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth/auth-client";
import { layout } from "@/lib/design-system";
import { signInSchema } from "../schemas";
import { AuthInputField } from "./AuthInputField";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type SignInFormValues = z.infer<typeof signInSchema>;

interface SignInFormProps {
  onSuccess?: () => void;
  callbackURL?: string;
}

const fieldAnimation = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export function SignInForm({ onSuccess, callbackURL = "/dashboard" }: SignInFormProps) {
  const [loading, startTransition] = useTransition();
  const [lastUsedEmail, setLastUsedEmail] = useState(false);

  useEffect(() => {
    const checkLastUsed = async () => {
      const result = await authClient.isLastUsedLoginMethod("email");
      setLastUsedEmail(result);
    };
    checkLastUsed();
  }, []);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onBlur",
  });

  const onSubmit = (data: SignInFormValues) => {
    startTransition(async () => {
      await authClient.signIn.email(
        {
          email: data.email,
          password: data.password,
          callbackURL,
        },
        {
          onSuccess() {
            toast.success("Successfully signed in");
            onSuccess?.();
          },
          onError(context) {
            toast.error(context.error.message);
          },
        },
      );
    });
  };

  return (
    <motion.form
      onSubmit={form.handleSubmit(onSubmit)}
      className={layout.fieldStack}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <FieldGroup className={layout.fieldStack}>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <AuthInputField
              label="Email"
              icon={Mail}
              type="email"
              id="sign-in-email"
              placeholder="you@example.com"
              autoComplete="email"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              invalid={fieldState.invalid}
              errorMessage={fieldState.error?.message}
              showLastUsed={lastUsedEmail}
            />
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <AuthInputField
              label="Password"
              icon={Lock}
              type="password"
              id="sign-in-password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              invalid={fieldState.invalid}
              errorMessage={fieldState.error?.message}
            />
          )}
        />
      </FieldGroup>

      {/* Submit Button */}
      <motion.div variants={fieldAnimation} style={{ transitionDelay: "0.24s" }} className="mt-2">
        <Button
          type="submit"
          variant="success"
          className={cn(
            "relative h-11 w-full text-base font-semibold overflow-hidden",
            "group transition-all duration-200",
            loading && "opacity-80 cursor-wait",
          )}
          disabled={loading}
        >
          <span className="relative flex items-center justify-center gap-2">
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                <span>Signing in…</span>
              </>
            ) : (
              "Sign in"
            )}
          </span>

          {/* Subtle shine sweep on hover */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
            aria-hidden="true"
          />
        </Button>
      </motion.div>
    </motion.form>
  );
}
