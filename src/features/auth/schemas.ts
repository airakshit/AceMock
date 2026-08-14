import * as z from "zod";

export const signInSchema = z.object({
    email: z.email("Please enter a valid email address."),
    password: z.string().min(1, "Password is required."),
});

export const signUpSchema = z.object({
    email: z.email("Please enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
});
