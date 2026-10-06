"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireAdmin } from "@/features/shared/actions/require-admin";
import { ServerActionResult } from "@/features/shared/actions/types";
import { SearchMockTestsPayload } from "../dto/payloads";
import { MockTestSearchResult } from "../dto/results";
import { mockTestsService } from "../service";

/**
 * Searches mock tests with optional scope / subject / section / chapter /
 * creator / name filters and keyset (cursor) pagination.
 *
 * Admin only: this is the single search whose payload decides *whose* tests
 * are returned (`byAdmin`), so it must not be reachable from the student
 * views — those use `searchApplicationTestsAction` /
 * `searchMyCustomTestsAction`, which pin the flags server-side.
 */
export async function searchMockTestsAction(
  payload: SearchMockTestsPayload = {},
): Promise<ServerActionResult<MockTestSearchResult>> {
  try {
    await requireAdmin();

    const data = await mockTestsService.searchMockTests(payload);

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
