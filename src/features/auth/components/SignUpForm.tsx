"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Lock } from "lucide-react";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth/auth-client";
import { layout } from "@/lib/design-system";
import { signUpSchema } from "../schemas";
import { AuthInputField } from "./AuthInputField";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type SignUpFormValues = z.infer<typeof signUpSchema>;

interface SignUpFormProps {
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

export function SignUpForm({ onSuccess, callbackURL = "/dashboard" }: SignUpFormProps) {
  const [loading, startTransition] = useTransition();

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onBlur",
  });

  const onSubmit = (data: SignUpFormValues) => {
    startTransition(async () => {
      const name = data.email.split("@")[0] || "User";

      await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name,
        callbackURL,
        fetchOptions: {
          onError: (ctx) => {
            toast.error(ctx.error.message);
          },
          onSuccess: async () => {
            toast.success("Account created successfully");
            onSuccess?.();
          },
        },
      });
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
              id="sign-up-email"
              placeholder="you@example.com"
              autoComplete="email"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              invalid={fieldState.invalid}
              errorMessage={fieldState.error?.message}
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
              id="sign-up-password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
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
                <span>Creating account…</span>
              </>
            ) : (
              "Create account"
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
