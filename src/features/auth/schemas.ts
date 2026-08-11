import * as z from "zod";

export const signInSchema = z.object({
    email: z.email("Please enter a valid email address."),
    password: z.string().min(1, "Password is required."),
    rememberMe: z.boolean(),
});

export const signUpSchema = z
    .object({
        firstName: z.string().min(1, "First name is required."),
        lastName: z.string().min(1, "Last name is required."),
        email: z.email("Please enter a valid email address."),
        password: z.string().min(8, "Password must be at least 8 characters."),
        passwordConfirmation: z
            .string()
            .min(1, "Please confirm your password."),
    })
    .refine((data) => data.password === data.passwordConfirmation, {
        message: "Passwords do not match.",
        path: ["passwordConfirmation"],
    });
