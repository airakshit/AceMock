import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
    const cookies = getSessionCookie(request);
    // This checks the session cookie only. Doesn't validate.

    if (!cookies) {
        return NextResponse.redirect(new URL("/signin", request.url));
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard"],
};
