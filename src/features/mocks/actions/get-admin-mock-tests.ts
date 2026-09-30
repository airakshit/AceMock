"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireAdmin } from "@/features/shared/actions/require-admin";
import { ServerActionResult } from "@/features/shared/actions/types";
import { MockTestListResult } from "../dto/results";
import { mockTestsService } from "../service";

export async function getAdminMockTestsAction(options?: {
  search?: string;
}): Promise<ServerActionResult<MockTestListResult>> {
  try {
    await requireAdmin();

    const data = await mockTestsService.getAllMockTests(options);

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
