import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { MOCK_ACE_COOKIE_PREFIX } from "./lib/constants";

export async function proxy(request: NextRequest) {
  const cookies = getSessionCookie(request, {
    cookiePrefix: MOCK_ACE_COOKIE_PREFIX,
  });

  if (!cookies) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/mocks", "/custom"],
};
