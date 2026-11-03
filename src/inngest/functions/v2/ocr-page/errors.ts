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

export class OcrValidationError extends OcrError {
  public readonly validationErrors?: string[];
  public readonly pageNo?: number;
  public readonly attempt?: number;

  constructor(
    message: string,
    options?: {
      validationErrors?: string[];
      pageNo?: number;
      attempt?: number;
    },
  ) {
    super(message);
    this.name = "OcrValidationError";
    this.validationErrors = options?.validationErrors;
    this.pageNo = options?.pageNo;
    this.attempt = options?.attempt;
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
 * Thrown when stage-1 and stage-2 outputs cannot be merged due to serial
 * number mismatches or missing figure data. Non-retriable by design.
 */
export class OcrMergeError extends OcrError {
  public readonly pageNo?: number;

  constructor(message: string, pageNo?: number) {
    super(message);
    this.name = "OcrMergeError";
    this.pageNo = pageNo;
  }
}
