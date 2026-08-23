import { createAuthClient } from "better-auth/react";
import { env } from "@/config/env/client";
import { lastLoginMethodClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_APP_URL,

  plugins: [lastLoginMethodClient()],
});
