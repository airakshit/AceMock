"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireAdmin } from "@/features/shared/actions/require-admin";
import { ServerActionResult } from "@/features/shared/actions/types";
import { DeleteMockTestResult } from "../dto/results";
import { mockTestsService } from "../service";

export async function deleteMockTestAction(
  id: string,
): Promise<ServerActionResult<DeleteMockTestResult>> {
  try {
    await requireAdmin();

    const data = await mockTestsService.deleteMockTest(id);

    return {
      success: true,
      data,
      message: "Mock test deleted successfully.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
