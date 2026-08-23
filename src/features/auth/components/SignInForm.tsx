"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { authClient } from "@/lib/auth/auth-client";
import { LastUsedIndicator } from "@/components/shared/LastUsedIndicator";
import { layout } from "@/lib/design-system";
import { signInSchema } from "../schemas";

type SignInFormValues = z.infer<typeof signInSchema>;

interface SignInFormProps {
  onSuccess?: () => void;
  callbackURL?: string;
}

export function SignInForm({
  onSuccess,
  callbackURL = "/dashboard",
}: SignInFormProps) {
  const [loading, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
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
    <form onSubmit={form.handleSubmit(onSubmit)} className={layout.fieldStack}>
      <FieldGroup className={layout.fieldStack}>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="sign-in-email">Email</FieldLabel>
              <Input
                {...field}
                id="sign-in-email"
                type="email"
                placeholder="you@example.com"
                aria-invalid={fieldState.invalid}
                autoComplete="email"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="sign-in-password">Password</FieldLabel>
              <PasswordInput
                {...field}
                id="sign-in-password"
                placeholder="Enter your password"
                aria-invalid={fieldState.invalid}
                autoComplete="current-password"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <Button type="submit" className="relative h-10 w-full" disabled={loading}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : "Log in"}
        {isMounted && authClient.isLastUsedLoginMethod("email") && (
          <LastUsedIndicator />
        )}
      </Button>
    </form>
  );
}
