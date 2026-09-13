import { BaseLLMService } from "./base-llm.service";

export const OpenRouterModels = {
  /**
   * Free Vision & Multimodal models capable of processing images, LaTeX formulas, and OCR.
   * Recommended for document question extraction and OCR pipelines.
   */
  FREE_VISION: {
    INCLUSION_AI_LING_3_FLASH_V1: "inclusionai/ling-3.0-flash-vl:free",
    DOTS_3_NOTE_PREVIEW: "dots-studio/dots-3-note-preview:free",

    THINKING_MACHINES_INKLING_SMALL: "thinkingmachines/inkling-small:free",
    THINKING_MACHINES_INKLING: "thinkingmachines/inkling:free",

    MINIMAX_M3: "minimax/minimax-m3:free",

    NEX_AGI_NEX_2_5_PRO: "nex-agi/nex-n2.5-pro:free"

  },

  /**
   * Free Text & Reasoning models (without image input support).
   */
  FREE_TEXT: {
    /** DeepSeek R1 - State-of-the-art chain-of-thought reasoning */
    DEEPSEEK_R1: "deepseek/deepseek-r1:free",
    /** Meta Llama 3.3 70B Instruct - High-accuracy general text */
    LLAMA_3_3_70B: "meta-llama/llama-3.3-70b-instruct:free",
    /** Qwen 2.5 72B Instruct - High capability instruction model */
    QWEN_2_5_72B: "qwen/qwen-2.5-72b-instruct:free",
    /** Google Gemini 2.0 Flash Lite */
    GEMINI_2_FLASH_LITE: "google/gemini-2.0-flash-lite-preview:free",
  },
} as const;

export type OpenRouterModel =
  | (typeof OpenRouterModels.FREE_VISION)[keyof typeof OpenRouterModels.FREE_VISION]
  | (typeof OpenRouterModels.FREE_TEXT)[keyof typeof OpenRouterModels.FREE_TEXT]
  | (string & {});

export interface OpenRouterServiceOptions {
  siteUrl?: string;
  siteName?: string;
}

/**
 * OpenRouter LLM Service client extending BaseLLMService.
 * Supports OpenAI-compatible multimodal chat completions endpoint with
 * automatic image format packaging and standard error propagation.
 */
export class OpenRouterLLMService extends BaseLLMService<OpenRouterModel> {
  private readonly baseUrl = "https://openrouter.ai/api/v1/chat/completions";
  private readonly siteUrl?: string;
  private readonly siteName?: string;

  constructor(
    apiKey: string,
    defaultModel: OpenRouterModel = OpenRouterModels.FREE_VISION.DOTS_3_NOTE_PREVIEW,
    options?: OpenRouterServiceOptions,
  ) {
    super(apiKey, defaultModel);
    this.siteUrl = options?.siteUrl || "http://localhost:3000";
    this.siteName = options?.siteName || "AceMock";
  }

  async call(
    prompt: string,
    model?: OpenRouterModel,
    imageUrls?: string[],
  ): Promise<string | null> {
    const selectedModel = model || this.model;
    const hasImages = imageUrls && imageUrls.length > 0;

    const content = hasImages
      ? [
        { type: "text", text: prompt },
        ...imageUrls
          .filter(Boolean)
          .map((url) => ({
            type: "image_url",
            image_url: { url },
          })),
      ]
      : prompt;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    if (this.siteUrl) headers["HTTP-Referer"] = this.siteUrl;
    if (this.siteName) headers["X-Title"] = this.siteName;

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: "user",
            content,
          },
        ],
      }),
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }

      const errorMessage =
        typeof errorBody === "object" && errorBody !== null && "error" in errorBody
          ? JSON.stringify((errorBody as { error: unknown }).error)
          : String(errorBody);

      const error = new Error(`OpenRouter API Error ${response.status}: ${errorMessage}`) as Error & {
        status?: number;
        headers?: Headers;
        error?: unknown;
      };

      error.status = response.status;
      error.headers = response.headers;
      error.error = errorBody;

      throw error;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? null;
  }
}
