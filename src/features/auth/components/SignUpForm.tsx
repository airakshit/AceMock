"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTransition } from "react";
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
import { layout } from "@/lib/design-system";
import { signUpSchema } from "../schemas";

type SignUpFormValues = z.infer<typeof signUpSchema>;

interface SignUpFormProps {
  onSuccess?: () => void;
  callbackURL?: string;
}

export function SignUpForm({
  onSuccess,
  callbackURL = "/dashboard",
}: SignUpFormProps) {
  const [loading, startTransition] = useTransition();

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
    },
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
    <form onSubmit={form.handleSubmit(onSubmit)} className={layout.fieldStack}>
      <FieldGroup className={layout.fieldStack}>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="sign-up-email">Email</FieldLabel>
              <Input
                {...field}
                id="sign-up-email"
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
              <FieldLabel htmlFor="sign-up-password">Password</FieldLabel>
              <PasswordInput
                {...field}
                id="sign-up-password"
                placeholder="At least 8 characters"
                aria-invalid={fieldState.invalid}
                autoComplete="new-password"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <Button type="submit" className="h-10 w-full" disabled={loading}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : "Sign up"}
      </Button>
    </form>
  );
}
