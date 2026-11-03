import { describe, expect, it } from "vitest";
import { mergeOcrResults } from "../src/inngest/functions/v2/extract-questions/merge-ocr-results";
import { parseAndValidateStructuredOCR } from "../src/inngest/functions/v2/ocr-page/utils";

const box = {
  xMin: 0.1,
  yMin: 0.2,
  xMax: 0.4,
  yMax: 0.5,
};

function parse(data: unknown) {
  const result = parseAndValidateStructuredOCR(JSON.stringify(data));
  expect(result.survivedValidation).toBe(true);
  expect(result.parsedStructuredData).toBeDefined();
  return result.parsedStructuredData!;
}

describe("v2 structured OCR schema", () => {
  it("repairs bounding boxes reported on the 0-1000 grounding scale", () => {
    const parsed = parse({
      isRelevant: true,
      data: [
        {
          serialNo: 1,
          question: {
            text: "A circuit question.",
            figures: [{ xMin: 82, yMin: 312, xMax: 447, yMax: 401 }],
          },
        },
      ],
    });

    expect(parsed.data[0].question?.figures).toEqual([
      { xMin: 0.082, yMin: 0.312, xMax: 0.447, yMax: 0.401 },
    ]);
  });

  it("repairs bounding boxes reported as 0-100 percentages", () => {
    const parsed = parse({
      isRelevant: true,
      data: [
        {
          serialNo: 2,
          solution: {
            text: "Velocity-time graph solution.",
            figures: [{ xMin: 8.2, yMin: 31.2, xMax: 44.7, yMax: 40.1 }],
          },
        },
      ],
    });

    expect(parsed.data[0].solution?.figures).toEqual([
      { xMin: 0.082, yMin: 0.312, xMax: 0.447, yMax: 0.401 },
    ]);
  });

  it("leaves already-normalized 0-1 boxes untouched", () => {
    const parsed = parse({
      isRelevant: true,
      data: [
        {
          serialNo: 3,
          question: { text: "Text.", figures: [box] },
          options: {
            A: { text: "a" },
            B: null,
            C: null,
            D: null,
          },
        },
      ],
    });

    expect(parsed.data[0].question?.figures).toEqual([box]);
  });

  it("normalizes singular and plural figure keys according to the containing field", () => {
    const parsed = parse({
      isRelevant: true,
      data: [
        {
          serialNo: 1,
          question: { text: "Question text", figure: box },
          solution: { text: "Solution text", figures: box },
          options: {
            A: { text: "Option A", figures: [box] },
            B: { text: "Option B", figure: [box] },
          },
        },
      ],
    });

    expect(parsed.data[0]).toMatchObject({
      question: { text: "Question text", figures: [box] },
      solution: { text: "Solution text", figures: [box] },
      options: {
        A: { text: "Option A", figure: box },
        B: { text: "Option B", figure: box },
      },
    });
  });

  it("normalizes nullable values emitted by the strict provider schema", () => {
    const parsed = parse({
      isRelevant: true,
      data: [
        {
          serialNo: 4,
          question: null,
          solution: { text: null, figures: null },
          options: {
            A: { text: null, figure: null },
            B: null,
            C: null,
            D: null,
          },
        },
      ],
    });

    expect(parsed.data[0]).toMatchObject({
      solution: {},
      options: { A: {} },
    });
    expect(parsed.data[0].question).toBeUndefined();
  });

  it("normalizes previously stored flat OCR page results", () => {
    const parsed = parse({
      isRelevant: true,
      data: [
        {
          serialNo: 2,
          question: "Legacy question",
          questionFigures: [box],
          solution: "Legacy solution",
          solutionFigures: [box],
          options: { A: "Legacy option" },
          optionFigures: { A: box },
        },
      ],
    });

    expect(parsed.data[0]).toMatchObject({
      question: { text: "Legacy question", figures: [box] },
      solution: { text: "Legacy solution", figures: [box] },
      options: { A: { text: "Legacy option", figure: box } },
    });
  });

  it("merges nested OCR content into the existing resolved question shape", () => {
    const rawText = JSON.stringify({
      isRelevant: true,
      data: [
        {
          serialNo: 3,
          question: { text: "Nested question", figures: [box] },
          options: {
            A: { text: "First choice", figure: box },
            B: { text: "Second choice", figure: null },
            C: null,
            D: null,
          },
          answerKey: "B",
          solution: { text: "Nested solution", figures: [box] },
        },
      ],
    });
    const parsed = parseAndValidateStructuredOCR(rawText);
    expect(parsed.parsedStructuredData).toBeDefined();

    const merged = mergeOcrResults([
      {
        pageNo: 1,
        pageId: "page-1",
        fileId: "file-1",
        rawText,
        status: "completed",
        survivedValidation: true,
        isRelevant: true,
        parsedData: parsed.parsedStructuredData,
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      question: "Nested question",
      options: [
        { key: "A", text: "First choice" },
        { key: "B", text: "Second choice" },
      ],
      correctOption: "B",
      solution: "Nested solution",
      questionFigures: [box],
      solutionFigures: [box],
      optionFigures: { A: box },
    });
  });
});
