import { describe, expect, it } from "vitest";
import {
  canonicalizeSegment,
  formatPathDisplay,
  inheritPath,
  isDirectChildPath,
  isPrefixPath,
  labelKind,
  labelValue,
  pathKey,
  samePath,
  segmentsForFilename,
  segmentsFromKey,
} from "../src/inngest/functions/v3/ocr-page/path-utils";

describe("v3 path-utils: canonicalization", () => {
  it("strips printer decoration and case-folds labels", () => {
    expect(canonicalizeSegment("(ii)")).toBe("ii");
    expect(canonicalizeSegment("Q.7.")).toBe("7");
    expect(canonicalizeSegment("4.")).toBe("4");
    expect(canonicalizeSegment("  B) ")).toBe("b");
  });

  it("produces stable keys from differently-but-equivalently written paths", () => {
    expect(pathKey(["4", "(ii)"])).toBe(pathKey([" 4 ", "ii"]));
    expect(pathKey(null)).toBe("[]");
    expect(pathKey([])).toBe("[]");
  });

  it("round-trips through segmentsFromKey", () => {
    const key = pathKey(["4", "ii"]);
    expect(segmentsFromKey(key)).toEqual(["4", "ii"]);
  });

  it("matches paths canonically", () => {
    expect(samePath(["4", "II"], ["4", "ii"])).toBe(true);
    expect(samePath(["4", "ii"], ["4", "iii"])).toBe(false);
    expect(isPrefixPath(["4"], ["4", "ii"])).toBe(true);
    expect(isPrefixPath(["4", "ii"], ["4"])).toBe(false);
    expect(isDirectChildPath(["4"], ["4", "ii"])).toBe(true);
    expect(isDirectChildPath(["4"], ["4", "ii", "b"])).toBe(false);
  });
});

describe("v3 path-utils: label kinds and values", () => {
  it("classifies labels", () => {
    expect(labelKind("4")).toBe("arabic");
    expect(labelKind("iv")).toBe("lowerRoman");
    expect(labelKind("IV")).toBe("upperRoman");
    expect(labelKind("b")).toBe("lowerAlpha");
    expect(labelKind("B")).toBe("upperAlpha");
    expect(labelKind("12a")).toBe("other");
  });

  it("reads sequence values", () => {
    expect(labelValue("12")).toBe(12);
    expect(labelValue("iv")).toBe(4);
    expect(labelValue("x")).toBe(10);
    expect(labelValue("c")).toBe(3);
  });
});

describe("v3 path-utils: incomplete path inheritance", () => {
  it("sibling: (ii) after [4,i] extends to [4,ii]", () => {
    expect(inheritPath(["4", "i"], ["ii"])).toEqual(["4", "ii"]);
    expect(inheritPath(["4", "ii"], ["iii"])).toEqual(["4", "iii"]);
  });

  it("re-printed same label maps onto the open record", () => {
    expect(inheritPath(["4", "ii"], ["ii"])).toEqual(["4", "ii"]);
  });

  it("top-level advance: 5 printed after [4,ii] is its own path", () => {
    expect(inheritPath(["4", "ii"], ["5"])).toEqual(["5"]);
  });

  it("deeper suffix: [ii,b] under [4,i] trims the chain and appends", () => {
    expect(inheritPath(["4", "i"], ["ii", "b"])).toEqual(["4", "ii", "b"]);
  });

  it("rejects unconfident inheritance", () => {
    // Value regression at top level (section restart ambiguity).
    expect(inheritPath(["12"], ["4"])).toBeNull();
    // Unknown kind mismatch without a confident increment.
    expect(inheritPath(["x"], ["?"])).toBeNull();
  });
});

describe("v3 path-utils: display and filenames", () => {
  it("formats display labels", () => {
    expect(formatPathDisplay(["4"])).toBe("4");
    expect(formatPathDisplay(["4", "ii"])).toBe("4(ii)");
    expect(formatPathDisplay(["4", "ii", "b"])).toBe("4(ii)(b)");
    expect(formatPathDisplay(null)).toBe("");
  });

  it("builds safe filename segments", () => {
    expect(segmentsForFilename(["4", "ii"])).toBe("4-ii");
    expect(segmentsForFilename(["Q.(7)", "A/B"])).toBe("q7-ab");
    expect(segmentsForFilename([])).toBe("unlabeled");
  });
});
