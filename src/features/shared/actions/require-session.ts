"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { ServerActionError } from "./error";

export async function requireSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new ServerActionError(
      "UNAUTHORIZED",
      "Session not found. Please re-login.",
    );
  }

  return session;
}
