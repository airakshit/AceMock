"use server";

import { requireSession } from "@/features/shared/actions/require-session";
import { handleActionError } from "@/features/shared/actions/error";
import { ServerActionResult } from "@/features/shared/actions/types";
import { GetCurriculumOptionsResult } from "../dto/results";
import { questionsService } from "../service";

/**
 * Returns the whole curriculum (subjects → sections → chapters) as flat id
 * lists, for cascading pickers and hierarchy filters.
 */
export async function getCurriculumOptionsAction(): Promise<
  ServerActionResult<GetCurriculumOptionsResult>
> {
  try {
    await requireSession();

    const curriculum = await questionsService.getCurriculumOptions();

    return {
      success: true,
      data: { curriculum },
    };
  } catch (error) {
    return handleActionError(error);
  }
}
