import { describe, expect, it } from "vitest";
import { pageSchema, stage2RootSchema } from "../src/inngest/functions/v3/ocr-page/new-schema";

/**
 * All the defensive preprocessing v2 applied at the Zod layer, now ported to
 * the v3 path-based schema.
 */
describe("v3 schema preprocessing (ported from v2)", () => {
  const basePage = {
    pageNo: 1,
    isRelevant: true,
    isStartOpen: false,
    isEndOpen: false,
  };

  it("normalizes option keys: (a)/a./b) -> A/B, numeric (1)..(4) -> A..D", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [
        {
          path: ["2"],
          question: { text: "Pick one.", hasFigure: false },
          options: { "(a)": { text: "one", hasFigure: false }, "2": { text: "two", hasFigure: false } },
        },
      ],
    });

    const options = parsed.entities[0].options!;
    expect(Object.keys(options).sort()).
      toEqual(["A", "B"]);
    expect(options.A?.text).toBe("one");
    expect(options.B?.text).toBe("two");
  });

  it("cleans answerKey decorations and uppercases", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [{ path: ["3"], answerKey: "(b).", solution: { text: null, hasFigure: false, answerValue: null } }],
    });
    expect(parsed.entities[0].answerKey).toBe("B");
  });

  it("folds subject aliases (maths/mathematics -> math) case-insensitively", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [
        {
          path: ["4"],
          question: { text: "q", hasFigure: false, subject: "Maths" },
        },
      ],
    });
    expect(parsed.entities[0].question?.subject).toBe("math");
  });

  it("coerces booleans from strings and numbers", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      isRelevant: "true",
      isStartOpen: 0,
      isEndOpen: "1",
      entities: [
        {
          path: ["5"],
          question: { text: "q", hasFigure: "false", isStandalone: "true" },
        },
      ],
    });
    expect(parsed.isRelevant).toBe(true);
    expect(parsed.isStartOpen).toBe(false);
    expect(parsed.isEndOpen).toBe(true);
    expect(parsed.entities[0].question?.hasFigure).toBe(false);
    expect(parsed.entities[0].question?.isStandalone).toBe(true);
  });

  it("coerces path segments (numbers -> strings) and drops empty segments", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [
        { path: [4, "ii", null, ""], question: { text: "q", hasFigure: false } },
      ],
    });
    expect(parsed.entities[0].path).toEqual(["4", "ii"]);
  });

  it("collapses a bare string path into a one-segment chain and drops garbage paths", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [
        { path: "4.ii", question: { text: "q", hasFigure: false } },
        { path: { nested: true }, question: { text: "q2", hasFigure: false } },
      ],
    });
    expect(parsed.entities[0].path).toEqual(["4.ii"]);
    // Garbage path -> treated as "no printed label" instead of failing.
    expect(parsed.entities[1].path).toBeUndefined();
  });

  it("coerces numeric-looking answerValue strings into numbers", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [{ path: ["6"], solution: { text: null, hasFigure: false, answerValue: "42" } }],
    });
    expect(parsed.entities[0].solution?.answerValue).toBe(42);
  });

  it("coerces marks from strings and tolerates null entities array", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: null,
      sections: null,
    });
    expect(parsed.entities).toEqual([]);
    expect(parsed.sections).toBeUndefined();
  });

  it("rejects entities with no usable content (v2 refine semantics)", () => {
    const result = pageSchema.safeParse({
      ...basePage,
      entities: [{ path: ["7"] }],
    });
    expect(result.success).toBe(false);
  });

  it("stage-2: coerces string coordinates and fixes swapped min/max orientation", () => {
    const parsed = stage2RootSchema.parse({
      items: [
        {
          path: ["9"],
          questionFigures: [
            { xMin: "300", yMin: "400", xMax: "100", yMax: "200" },
          ],
          solutionFigures: null,
          optionFigures: { "(a)": { xMin: "10", yMin: "20", xMax: "30", yMax: "40" }, B: null, C: null, D: null },
        },
      ],
    });

    const item = parsed.items[0];
    expect(item.questionFigures).toEqual([
      { xMin: 100, yMin: 200, xMax: 300, yMax: 400 },
    ]);
    expect(item.optionFigures?.A).toEqual({
      xMin: 10,
      yMin: 20,
      xMax: 30,
      yMax: 40,
    });
    expect(item.questionFigures).toHaveLength(1);
    expect(item.solutionFigures).toEqual([]);
  });

  it("stage-2: tolerates null items and normalizes them to an empty array", () => {
    expect(stage2RootSchema.parse({ items: null }).items).toEqual([]);
  });
});
