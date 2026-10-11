"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AuthInputFieldProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  type: string;
  id: string;
  placeholder: string;
  autoComplete: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  invalid: boolean;
  errorMessage?: string;
  showLastUsed?: boolean;
}

const fieldAnimation = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
};

/**
 * AuthInputField — the labelled, iconified input used by the auth forms.
 *
 * Defined at module level and self-contained (focus state lives here, value
 * arrives via props), so the DOM input is NEVER remounted while typing.
 * The previous inline-wrapper + form.watch() pattern remounted the field on
 * every keystroke, stealing focus instantly.
 */
export function AuthInputField({
  label,
  icon: Icon,
  type,
  id,
  placeholder,
  autoComplete,
  value,
  onChange,
  onBlur,
  invalid,
  errorMessage,
  showLastUsed,
}: AuthInputFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;
  const isValid = hasValue && !invalid;

  return (
    <motion.div variants={fieldAnimation} className="relative">
      <Field data-invalid={invalid} className="w-full">
        <FieldLabel htmlFor={id} className="mb-1.5">
          {label}
        </FieldLabel>

        <div className="relative">
          {/* Leading icon — locked to the vertical center of the input */}
          <Icon
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 transition-colors duration-200",
              invalid
                ? "text-destructive/70"
                : focused || hasValue
                  ? "text-emerald-500 dark:text-emerald-400"
                  : undefined,
            )}
          />

          <Input
            id={id}
            name={id}
            type={type}
            value={value}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur();
            }}
            placeholder={placeholder}
            autoComplete={autoComplete}
            aria-invalid={invalid}
            aria-describedby={invalid && errorMessage ? `${id}-error` : undefined}
            className={cn(
              "h-11 rounded-xl pl-10 pr-10",
              invalid
                ? "border-destructive/50 bg-destructive/5 focus:border-destructive focus:ring-destructive/20"
                : isValid
                  ? "border-emerald-400/40 bg-emerald-500/5 focus:border-emerald-400 focus:ring-emerald-400/20"
                  : "border-border/60 focus:border-emerald-400 focus:ring-emerald-400/20",
            )}
          />

          {/* Trailing valid / error indicator — centered on the same axis */}
          <AnimatePresence mode="wait">
            {isValid ? (
              <motion.span
                key="valid"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="pointer-events-none absolute right-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-emerald-500 dark:text-emerald-400"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </motion.span>
            ) : errorMessage ? (
              <motion.span
                key="error"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="pointer-events-none absolute right-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-destructive"
              >
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
              </motion.span>
            ) : null}
          </AnimatePresence>

          {/* "Last used" badge — floats on the field's top-right edge */}
          {showLastUsed && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-none absolute -top-2.5 right-3 z-10 flex h-5 items-center gap-1 whitespace-nowrap rounded-full border border-success/30 bg-success/20 px-2 text-[10px] font-semibold text-success shadow-md backdrop-blur-sm"
            >
              <span className="relative flex h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              Last used
            </motion.span>
          )}
        </div>

        {invalid && errorMessage && (
          <motion.p
            id={`${id}-error`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1.5 flex items-center gap-1 text-xs text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {errorMessage}
          </motion.p>
        )}
      </Field>
    </motion.div>
  );
}
