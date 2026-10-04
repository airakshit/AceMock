"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { SearchMockTestsPayload } from "../dto/payloads";
import { MockTestSearchResult } from "../dto/results";
import { mockTestsService } from "../service";

/**
 * Searches mock tests with optional scope / subject / section / chapter /
 * creator / name filters and keyset (cursor) pagination.
 *
 * Read-only and available to any signed-in user — it exposes exactly the
 * same tests as the regular mock test list, just filtered and paginated.
 */
export async function searchMockTestsAction(
  payload: SearchMockTestsPayload = {},
): Promise<ServerActionResult<MockTestSearchResult>> {
  try {
    await requireSession();

    const data = await mockTestsService.searchMockTests(payload);

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
