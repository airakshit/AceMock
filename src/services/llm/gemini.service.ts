import { BaseLLMProvider, ChatCompletionResponse } from "./base";

export const GeminiModels = {
  GEMINI_2_5_FLASH: "gemini-2.5-flash",
  GEMINI_2_5_PRO: "gemini-2.5-pro",
  GEMINI_FLASH_LITE: "gemini-2.5-flash-lite",
  GEMMA_4_26B: "gemma-4-26b-a4b-it",
  GEMMA_4_31B: "gemma-4-31b-it",
} as const;

export type GeminiModel = (typeof GeminiModels)[keyof typeof GeminiModels];

interface GoogleRpcDetail {
  "@type": string;
  retryDelay?: string; // e.g. "1.500s" or "3s"
  reason?: string;
  domain?: string;
  metadata?: Record<string, string>;
}

interface GeminiExtendedErrorResponse {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    type?: string;
    details?: GoogleRpcDetail[];
  };
}

export class GeminiLLMService extends BaseLLMProvider<GeminiModel> {
  constructor(apiKey: string, defaultModel: GeminiModel = "gemma-4-31b-it") {
    super({
      providerName: "Gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey,
      availableModels: Object.values(GeminiModels),
      defaultModel,
    });
  }

  protected override handleErrors(
    res: Response,
    data: ChatCompletionResponse | null,
  ): never {
    const errorData = data as GeminiExtendedErrorResponse | null;
    const rawError = errorData?.error;

    // 1. Extract error message & status identifier
    const message =
      rawError?.message ?? res.statusText ?? "Unknown error occurred";
    const errorStatus = rawError?.status; // e.g., "RESOURCE_EXHAUSTED", "INVALID_ARGUMENT"

    // 2. Rate Limit Detection (HTTP 429 or RESOURCE_EXHAUSTED)
    if (res.status === 429 || errorStatus === "RESOURCE_EXHAUSTED") {
      const retryAfterMs = this.extractRetryDelay(res, rawError?.details);

      throw new RateLimitError(
        this.providerName,
        `[${this.providerName}] Rate limit exceeded: ${message}`,
        {
          model: this.model,
          retryAfterMs,
        },
        res.status,
        new LLMErrorOptions(true, data),
      );
    }

    // 3. Bad Request / Client Errors (HTTP 400 - 499)
    if (res.status >= 400 && res.status < 500) {
      throw new LLMServiceError(
        `[${this.providerName}] Client request error (${res.status}): ${message}`,
        this.providerName,
        new LLMErrorOptions(false, data),
        res.status,
      );
    }

    // 4. Server Errors (HTTP 500+) -> Retryable
    const isRetryableServer = res.status >= 500;
    throw new LLMServiceError(
      `[${this.providerName}] Provider error (${res.status}): ${message}`,
      this.providerName,
      new LLMErrorOptions(isRetryableServer, data),
      res.status,
    );
  }

  /**
   * Checks both HTTP 'retry-after' header and Google's JSON 'RetryInfo' block.
   * Defaults to 2000ms backoff if not specified.
   */
  private extractRetryDelay(
    res: Response,
    details?: GoogleRpcDetail[],
  ): number {
    // Check standard HTTP header first
    const headerValue = res.headers.get("retry-after");
    if (headerValue) {
      const parsedSeconds = parseFloat(headerValue);
      if (!isNaN(parsedSeconds)) {
        return Math.ceil(parsedSeconds * 1000);
      }
    }

    // Check Google RPC RetryInfo inside error payload
    if (details && Array.isArray(details)) {
      const retryInfo = details.find(
        (d) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
      );

      if (retryInfo?.retryDelay) {
        const seconds = parseFloat(retryInfo.retryDelay.replace("s", ""));
        if (!isNaN(seconds)) {
          return Math.ceil(seconds * 1000);
        }
      }
    }

    // Default fallback retry time
    return 2000;
  }
}
