import { z } from "zod";

const clientEnvSchema = z.object({
    NEXT_PUBLIC_APP_URL: z.url(),
});

export const env = clientEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
