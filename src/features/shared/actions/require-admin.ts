"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { ServerActionError } from "./error";

/**
 * Validates that the current request has an active session with an "admin" role.
 * Throws ServerActionError if unauthorized or forbidden.
 * Returns the authenticated admin session.
 */
export async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new ServerActionError(
      "UNAUTHORIZED",
      "Authentication required. Please sign in.",
    );
  }

  const user = session.user as typeof session.user & { role?: string };

  if (user.role !== "admin") {
    throw new ServerActionError(
      "FORBIDDEN",
      "Forbidden: Administrator privileges required.",
    );
  }

  return {
    ...session,
    user: {
      ...user,
      role: "admin" as const,
    },
  };
}
