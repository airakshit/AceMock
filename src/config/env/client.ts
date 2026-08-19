import { z } from "zod";

const clientEnvSchema = z.object({
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string(),
    SUPABASE_STORAGE_BUCKET_NAME: z.string(),
});

export const env = clientEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_STORAGE_BUCKET_NAME: process.env.SUPABASE_STORAGE_BUCKET_NAME,
});
