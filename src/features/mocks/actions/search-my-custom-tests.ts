"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { SearchMockTestsFiltersPayload } from "../dto/payloads";
import { MockTestSearchResult } from "../dto/results";
import { mockTestsService } from "../service";

/**
 * Searches the tests the signed-in user authored themselves, filtered by
 * name / scope / hierarchy with keyset (cursor) pagination.
 *
 * Backs `/mocks/custom`. `userId` comes from the session and is never taken
 * from the payload, so no caller can read another user's custom tests.
 */
export async function searchMyCustomTestsAction(
  payload: SearchMockTestsFiltersPayload = {},
): Promise<ServerActionResult<MockTestSearchResult>> {
  try {
    const session = await requireSession();

    const data = await mockTestsService.searchMyCustomTests(
      session.user.id,
      payload,
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
