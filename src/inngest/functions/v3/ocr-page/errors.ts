export class OcrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrError";
  }
}

export class OcrEmptyResponseError extends OcrError {
  constructor(message = "No response returned by LLM.") {
    super(message);
    this.name = "OcrEmptyResponseError";
  }
}

/**
 * Thrown when the LLM output fails schema validation at stage 1 (text) or
 * stage 2 (bounding boxes). Carries the full validation error list, the raw
 * model output (for debugging), the page, attempt number, and the offending
 * entity index so production logs show exactly what failed and why.
 */
export class OcrValidationError extends OcrError {
  public readonly validationErrors?: string[];
  public readonly pageNo?: number;
  public readonly attempt?: number;
  /** Which stage produced the error: "stage-1" | "stage-2". */
  public readonly stage?: "stage-1" | "stage-2";
  /** Raw LLM response text that failed validation (may be large; truncated by caller if needed). */
  public readonly rawOutput?: string;
  /** Index of the failing entity within `entities`, when known. */
  public readonly entityIndex?: number;

  constructor(
    message: string,
    options?: {
      validationErrors?: string[];
      pageNo?: number;
      attempt?: number;
      stage?: "stage-1" | "stage-2";
      rawOutput?: string;
      entityIndex?: number;
    },
  ) {
    super(message);
    this.name = "OcrValidationError";
    this.validationErrors = options?.validationErrors;
    this.pageNo = options?.pageNo;
    this.attempt = options?.attempt;
    this.stage = options?.stage;
    this.rawOutput = options?.rawOutput;
    this.entityIndex = options?.entityIndex;
  }
}

export class OcrPageFailedError extends OcrError {
  public readonly pageId: string;
  public readonly pageNo: number;

  constructor(pageId: string, pageNo: number, reason: string) {
    super(`OCR processing failed for page ${pageNo} (${pageId}): ${reason}`);
    this.name = "OcrPageFailedError";
    this.pageId = pageId;
    this.pageNo = pageNo;
  }
}

/**
 * Thrown when stage-1 and stage-2 outputs cannot be merged due to path
 * mismatches or missing figure data. Non-retriable by design.
 */
export class OcrMergeError extends OcrError {
  public readonly pageNo?: number;
  public readonly stage?: "stage-1" | "stage-2" | "merge";

  constructor(message: string, pageNo?: number, stage?: "stage-1" | "stage-2" | "merge") {
    super(message);
    this.name = "OcrMergeError";
    this.pageNo = pageNo;
    this.stage = stage;
  }
}
