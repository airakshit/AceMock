"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireAdmin } from "@/features/shared/actions/require-admin";
import { ServerActionResult } from "@/features/shared/actions/types";
import { DocumentOptionForMockProjection } from "../dto/projections";
import { mockTestsService } from "../service";

export async function getDocumentsForMockCreationAction(): Promise<
  ServerActionResult<DocumentOptionForMockProjection[]>
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
