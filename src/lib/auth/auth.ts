import { betterAuth } from "better-auth/minimal";
import { lastLoginMethod } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/db";
import { env } from "@/config/env/server";
import { nextCookies } from "better-auth/next-js";
import { account, session, user, verification } from "@/db/schemas/auth";
import { v7 as uuidv7 } from "uuid";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user,
            session,
            account,
            verification,
        },
    }),

    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
    },

    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // Refresh periodically
    },

    advanced: {
        cookiePrefix: "mock-ace",
        database: {
            generateId: () => uuidv7(),
        },
    },
    plugins: [nextCookies(), lastLoginMethod()],
});
