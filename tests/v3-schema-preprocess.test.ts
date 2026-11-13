import { describe, expect, it } from "vitest";
import {
  pageSchema,
  stage2RootSchema,
} from "../src/inngest/functions/v3/ocr-page/partial-schemas";
import { parsePartialStructuredOCR } from "../src/inngest/functions/v3/ocr-page/utils";

/**
 * All the defensive preprocessing v2 applied at the Zod layer, now ported to
 * the v3 path-based schema.
 */
describe("v3 schema preprocessing (ported from v2)", () => {
  const basePage = {
    pageNo: 1,
    isRelevant: true,
    startState: { refPath: null, obj: null },
    endState: { refPath: null },
  };

  it("normalizes option keys: (a)/a./b) -> A/B, numeric (1)..(4) -> A..D", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [
        {
          path: ["2"],
          question: {
            text: "Pick one.",
            hasFigure: false,
            isStandalone: true,
          },
          options: {
            "(a)": { text: "one", hasFigure: false },
            "2": { text: "two", hasFigure: false },
          },
        },
      ],
    });

    const options = parsed.entities[0].options!;
    expect(Object.keys(options).sort()).toEqual(["A", "B"]);
    expect(options.A?.text).toBe("one");
    expect(options.B?.text).toBe("two");
  });

  it("cleans answerKey decorations and uppercases", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [
        {
          path: ["3"],
          answerKey: "(b).",
          // NOTE: production routes responses through nullsToUndefined before
          // pageSchema, so an explicit null answerValue never reaches the
          // Zod layer; fixtures model the post-normalization payload.
          solution: { text: null, hasFigure: false, isStandalone: false },
        },
      ],
    });
    expect(parsed.entities[0].answerKey).toBe("B");
  });

  it("maps the schema-permitted STRING \"null\" to absent instead of failing the page (subject)", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [
        {
          path: ["4"],
          question: {
            text: "q",
            hasFigure: false,
            marks: "null",
            subject: "null",
            isStandalone: true,
          },
          answerKey: null,
        },
      ],
    });
    const question = parsed.entities[0].question!;
    expect(question.subject).toBeUndefined();
    expect(question.marks).toBeUndefined();
  });

  it("maps the schema-permitted STRING \"null\" to absent instead of failing the page (answerKey)", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [
        {
          path: ["5"],
          solution: { text: "s", hasFigure: false, isStandalone: true, answerValue: "null" },
          answerKey: "null",
        },
      ],
    });
    expect(parsed.entities[0].answerKey).toBeUndefined();
    expect(parsed.entities[0].solution!.answerValue).toBeUndefined();
  });

  it("keeps a genuine 0 marks/eachMarks while mapping \"null\"/empty to absent", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      sections: [
        {
          label: "Section A",
          startPath: "4",
          endPath: "20",
          eachMarks: 0,
        },
      ],
      entities: [
        {
          path: ["6"],
          question: { text: "q", hasFigure: false, marks: 0, isStandalone: true },
        },
      ],
    });
    expect(parsed.sections![0].eachMarks).toBe(0);
    expect(parsed.sections![0].startPath).toEqual(["4"]);
    expect(parsed.sections![0].endPath).toEqual(["20"]);
    expect(parsed.entities[0].question!.marks).toBe(0);
  });

  it("subject is the exact \"maths\" enum value — no alias folding, no case tolerance", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [
        {
          path: ["4"],
          question: {
            text: "q",
            hasFigure: false,
            subject: "maths",
            isStandalone: false,
          },
        },
      ],
    });
    expect(parsed.entities[0].question?.subject).toBe("maths");

    // Deliberately NOT normalized: any other spelling makes the page fail so
    // the prompt contract ("always emit maths") stays honest.
    expect(() =>
      pageSchema.parse({
        ...basePage,
        entities: [
          {
            path: ["4"],
            question: {
              text: "q",
              hasFigure: false,
              subject: "Maths",
              isStandalone: false,
            },
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      pageSchema.parse({
        ...basePage,
        entities: [
          {
            path: ["4"],
            question: {
              text: "q",
              hasFigure: false,
              subject: "math",
              isStandalone: false,
            },
          },
        ],
      }),
    ).toThrow();
  });

  it("coerces booleans from strings and numbers", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      isRelevant: "true",
      entities: [
        {
          path: ["5"],
          question: { text: "q", hasFigure: "false", isStandalone: "true" },
        },
      ],
    });
    expect(parsed.isRelevant).toBe(true);
    expect(parsed.entities[0].question?.hasFigure).toBe(false);
    expect(parsed.entities[0].question?.isStandalone).toBe(true);
  });

  it("coerces boundary refPath: strings, segments, garbage and \"null\"", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      startState: { refPath: "4.ii", obj: null },
      endState: { refPath: [4, "ii", null, ""] },
    });
    expect(parsed.startState.refPath).toEqual(["4.ii"]);
    expect(parsed.endState.refPath).toEqual(["4", "ii"]);

    // Garbage and "null" collapse to a null anchor, never inferred.
    const clean = pageSchema.parse({
      ...basePage,
      startState: { refPath: { nested: true }, obj: null },
      endState: { refPath: "null" },
    });
    expect(clean.startState.refPath).toBeNull();
    expect(clean.endState.refPath).toBeNull();
  });

  it("collapses content-less states and a null state to clean", () => {
    // A null state object (model noise) still parses as clean.
    const clean = parsePartialStructuredOCR(
      JSON.stringify({ ...basePage, endState: null, startState: null }),
    );
    expect(clean.survivedValidation).toBe(true);
    expect(clean.parsedStructuredData!.startState.refPath).toBeNull();
    expect(clean.parsedStructuredData!.startState.obj).toBeNull();
    expect(clean.parsedStructuredData!.endState.refPath).toBeNull();

    // startState: content-less fragment collapses to obj: null (explicit
    // nulls are stripped to undefined upstream, then the transform collapses
    // the all-null fragment).
    const parsed = parsePartialStructuredOCR(
      JSON.stringify({
        ...basePage,
        startState: {
          refPath: null,
          obj: { passage: null, question: null, solution: null, options: null, answerKey: null },
        },
      }),
    );
    expect(parsed.survivedValidation).toBe(true);
    expect(parsed.parsedStructuredData!.startState.refPath).toBeNull();
    expect(parsed.parsedStructuredData!.startState.obj).toBeNull();

    // endState: only the path reference lives here — obj is not part of the
    // state at all.
    const end = parsePartialStructuredOCR(
      JSON.stringify({ ...basePage, endState: { refPath: ["4", "ii"] } }),
    );
    expect(end.survivedValidation).toBe(true);
    expect(end.parsedStructuredData!.endState.refPath).toEqual(["4", "ii"]);
  });

  it("coerces path segments (numbers -> strings) and drops empty segments", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [
        {
          path: [4, "ii", null, ""],
          question: { text: "q", hasFigure: false, isStandalone: false },
        },
      ],
    });
    expect(parsed.entities[0].path).toEqual(["4", "ii"]);
  });

  it("collapses a bare string path into a one-segment chain and drops garbage paths", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [
        {
          path: "4.ii",
          question: { text: "q", hasFigure: false, isStandalone: false },
        },
        {
          path: { nested: true },
          question: { text: "q2", hasFigure: false, isStandalone: false },
        },
      ],
    });
    expect(parsed.entities[0].path).toEqual(["4.ii"]);
    // Garbage path -> treated as "no printed label" instead of failing.
    expect(parsed.entities[1].path).toBeUndefined();
  });

  it("coerces numeric-looking answerValue strings into numbers", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [
        {
          path: ["6"],
          solution: {
            text: null,
            hasFigure: false,
            isStandalone: false,
            answerValue: "42",
          },
        },
      ],
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

  it("drops content-less entities instead of failing the page (was: refine rejection)", () => {
    // A bare path marker with no question/solution/options/answerKey would
    // previously fail the whole page. It is dropped + logged now.
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [
        { path: ["7"] },
        {
          path: ["8"],
          question: { text: "q", hasFigure: false, isStandalone: false },
        },
      ],
    });
    expect(parsed.entities).toHaveLength(1);
    expect(parsed.entities[0].path).toEqual(["8"]);
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
          optionFigures: {
            "(a)": { xMin: "10", yMin: "20", xMax: "30", yMax: "40" },
            B: null,
            C: null,
            D: null,
          },
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

  it("entities: [null, null] parses as an empty page (all-null entities are dropped, not rejected)", () => {
    const parsed = pageSchema.parse({
      ...basePage,
      entities: [null, null],
    });
    expect(parsed.entities).toEqual([]);
  });

  it("requires isStandalone on question and solution blocks (model contract)", () => {
    // Missing on question -> page fails.
    expect(() =>
      pageSchema.parse({
        ...basePage,
        entities: [{ path: ["5"], question: { text: "q", hasFigure: false } }],
      }),
    ).toThrow();

    // Explicit null on solution -> also fails (boolean required).
    expect(() =>
      pageSchema.parse({
        ...basePage,
        entities: [
          {
            path: ["5"],
            solution: {
              text: "s",
              hasFigure: false,
              answerValue: null,
              isStandalone: null,
            },
          },
        ],
      }),
    ).toThrow();
  });
});
