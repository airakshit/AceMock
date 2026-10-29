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
