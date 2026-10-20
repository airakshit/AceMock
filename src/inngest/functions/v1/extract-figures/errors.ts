export class FigureExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FigureExtractionError";
  }
}

/** A figure job could not produce a usable result for its item. */
export class FigureExtractionFailedError extends FigureExtractionError {
  constructor(item: string, reason: string) {
    super(`Figure extraction failed for ${item}: ${reason}`);
    this.name = "FigureExtractionFailedError";
  }
}
