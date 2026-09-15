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

export class QuestionMergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestionMergeError";
  }
}

export class QuestionPersistError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "QuestionPersistError";
  }
}

export class ChapterResolutionError extends Error {
  constructor(subject: string, message?: string) {
    super(
      message ||
        `Failed to resolve or create chapter for subject: "${subject}".`,
    );
    this.name = "ChapterResolutionError";
  }
}
