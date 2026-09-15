class LLMServiceError extends Error {
  public llmProvider: string;
  public statusCode?: number | undefined;

  constructor(
    message: string,
    provider: string,
    options?: ErrorOptions,
    statusCode?: number,
  ) {
    super(message, options);
    this.llmProvider = provider;
    this.statusCode = statusCode;
  }
}

class RateLimitError extends LLMServiceError {
  readonly errorCode = "RATE_LIMIT_ERROR";
  public model: string;
  public retryAfterMs: number;

  constructor(
    provider: string,
    message: string,
    details: {
      model: string;
      retryAfterMs: number;
    },
    statusCode?: number,
    options?: ErrorOptions,
  ) {
    super(message, provider, options, statusCode);
    this.model = details.model;
    this.retryAfterMs = details.retryAfterMs;
  }
}
