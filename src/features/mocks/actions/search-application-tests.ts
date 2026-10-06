"use server";

import { handleActionError } from "@/features/shared/actions/error";
import { requireSession } from "@/features/shared/actions/require-session";
import { ServerActionResult } from "@/features/shared/actions/types";
import { SearchMockTestsFiltersPayload } from "../dto/payloads";
import { MockTestSearchResult } from "../dto/results";
import { mockTestsService } from "../service";

/**
 * Searches the mock tests published by the application (`byAdmin = true`),
 * filtered by name / scope / hierarchy with keyset (cursor) pagination.
 *
 * Backs `/mocks/tests`. The creator flag is pinned server-side — unlike the
 * admin panel's search, a client cannot widen the result set to other users'
 * tests through the payload.
 */
export async function searchApplicationTestsAction(
  payload: SearchMockTestsFiltersPayload = {},
): Promise<ServerActionResult<MockTestSearchResult>> {
  try {
    await requireSession();

    const data = await mockTestsService.searchApplicationTests(payload);

    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
