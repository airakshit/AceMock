import { describe, expect, it } from "vitest";
import {
  FAILURE_REASONS,
  failureReasonEnum,
} from "../src/db/schemas/questions/questions";
import {
  buildFailureReasons,
  deriveFigureFailureReason,
  FIGURE_FAILURE_REASONS,
  READINESS_REASONS,
} from "../src/inngest/functions/v3/extract-questions/readiness";

/**
 * `FAILURE_REASONS` in the questions DB schema is the SINGLE source of
 * truth for the `not_ready_reason` array column. The pipeline's derivation
 * groups (readiness gaps + figure codes) must exactly partition it — the
 * repository inserts pipeline values straight into the enum array.
 */
describe("failure reasons: pipeline <-> db enum sync", () => {
  it("readiness + figure groups exactly partition the canonical list", () => {
    const union = [...READINESS_REASONS, ...FIGURE_FAILURE_REASONS].sort();
    expect(union).toEqual([...FAILURE_REASONS].sort());
  });

  it("the pgEnum carries the canonical list", () => {
    expect([...failureReasonEnum.enumValues].sort()).toEqual(
      [...FAILURE_REASONS].sort(),
    );
  });

  it("buildFailureReasons combines readiness + figure codes", () => {
    expect(buildFailureReasons(["missing solution", "missing answer key"], null)).toEqual([
      "missing solution",
      "missing answer key",
    ]);
    expect(buildFailureReasons([], "figure_not_found")).toEqual(["figure_not_found"]);
  });

  it("derivation precedence: figure_not_found wins over a missing box", () => {
    expect(
      deriveFigureFailureReason({ figureResolved: false, figureNotFound: true }),
    ).toBe("figure_not_found");
    expect(
      deriveFigureFailureReason({ figureResolved: false, figureNotFound: undefined }),
    ).toBe("figure_unresolved");
    expect(
      deriveFigureFailureReason({ figureResolved: true, figureNotFound: false }),
    ).toBeNull();
    expect(
      deriveFigureFailureReason({ figureResolved: undefined, figureNotFound: undefined }),
    ).toBeNull();
  });
});
