"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireAdmin } from "@/features/shared/actions/require-admin";
import { ServerActionResult } from "@/features/shared/actions/types";

import { mockTestsService } from "../service";
import { DocumentWithQuestionCountProjection } from "@/features/documents/dto/projections";

export async function getDocumentsForMockCreationAction(): Promise<
  ServerActionResult<DocumentWithQuestionCountProjection[]>
> {
  try {
    await requireAdmin();

    const data = await mockTestsService.getDocumentsForMockCreation();

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
