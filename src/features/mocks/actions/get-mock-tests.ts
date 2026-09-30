"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { MockTestListResult } from "../dto/results";
import { mockTestsService } from "../service";

export async function getMockTestsAction(options?: {
  search?: string;
}): Promise<ServerActionResult<MockTestListResult>> {
  try {
    await requireSession();

    const data = await mockTestsService.getAllMockTests(options);

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
