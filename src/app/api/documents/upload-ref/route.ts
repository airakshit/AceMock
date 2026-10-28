import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { documentsService } from "@/features/documents/service";
import { ServerActionError } from "@/features/shared/actions/error";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Unauthorized. Please log in." },
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { sessionId, documentFileId, uploadRef } = body ?? {};

    if (!sessionId || !documentFileId || !uploadRef) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Missing required fields: sessionId, documentFileId, uploadRef",
          },
        },
        { status: 400 },
      );
    }

    const data = await documentsService.saveUploadReference(session.user.id, {
      sessionId,
      documentFileId,
      uploadRef,
    });

    return NextResponse.json({
      success: true,
      data,
      message: "Upload reference saved.",
    });
  } catch (error) {
    if (error instanceof ServerActionError) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        CONFLICT: 409,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
      };
      const status = statusMap[error.code] ?? 400;
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status },
      );
    }

    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
