"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireAdmin } from "@/features/shared/actions/require-admin";
import { ServerActionResult } from "@/features/shared/actions/types";
import { MockTestDetailsResult } from "../dto/results";
import { mockTestsService } from "../service";

export async function getAdminMockTestDetailsAction(
  id: string,
): Promise<ServerActionResult<MockTestDetailsResult>> {
  try {
    await requireAdmin();

    const data = await mockTestsService.getMockTestById(id);

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
