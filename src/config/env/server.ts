// import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),

    NEXT_PUBLIC_APP_URL: z.url(),
    DATABASE_URL: z.string().min(1),

    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),

    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
});

export const env = serverEnvSchema.parse(process.env);
