import { BaseLLMProvider } from "./base";
import { ChatCompletionResponse } from "./base";

export const OpenRouterModels = {
  INCLUSION_AI_LING_3_FLASH_V1: "inclusionai/ling-3.0-flash-vl:free",
  DOTS_3_NOTE_PREVIEW: "dots-studio/dots-3-note-preview:free",

  THINKING_MACHINES_INKLING_SMALL: "thinkingmachines/inkling-small:free",
  THINKING_MACHINES_INKLING: "thinkingmachines/inkling:free",

  MINIMAX_M_3_1_FLASH: "minimax/minimax-m3.1-flash:free",
  NVIDIA_NEMOTRON_3_5_SUPER_VL: "nvidia/nemotron-3.5-super-vl:free",
  NEX_AGI_NEX_2_5_PRO: "nex-agi/nex-n2.5-pro:free",
} as const;

export type OpenRouterModel =
  (typeof OpenRouterModels)[keyof typeof OpenRouterModels];

interface OpenRouterErrorResponse {
  error: {
    code: number | string;
    message?: string;
    metadata?: Record<string, unknown>;
  };
}

export class OpenRouterLLMService extends BaseLLMProvider<OpenRouterModel> {
  constructor(
    apiKey: string,
    defaultModel: OpenRouterModel = "dots-studio/dots-3-note-preview:free",
  ) {
    super({
      providerName: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey,
      availableModels: Object.values(OpenRouterModels),
      defaultModel,
    });
  }

  protected handleErrors(
    res: Response,
    data: ChatCompletionResponse | null,
  ): void {
    const errorData = data as OpenRouterErrorResponse | null;

    console.error("OpenRouter error:", {
      status: res.status,
      statusText: res.statusText,
      code: errorData?.error?.code,
      message: errorData?.error?.message,
      metadata: errorData?.error?.metadata,
    });

    throw new Error(
      `[${this.providerName}] ${res.status} ${
        errorData?.error?.message ?? res.statusText
      }`,
    );
  }
}
