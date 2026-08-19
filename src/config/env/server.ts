// import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),

    NEXT_PUBLIC_APP_URL: z.url(),
    DATABASE_URL: z.string().min(1),
    GROQ_API_KEY: z.string(),

    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),

    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),

    NEXT_PUBLIC_SUPABASE_URL: z.url().min(1),
    SUPABASE_SECRET_KEY: z.string(),
    SUPABASE_STORAGE_BUCKET_NAME: z.string(),
});

export const env = serverEnvSchema.parse(process.env);
