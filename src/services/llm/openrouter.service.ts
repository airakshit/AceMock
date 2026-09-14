import { OpenAICompatibleLLM } from "./base";

export const OpenRouterModels = {
  INCLUSION_AI_LING_3_FLASH_V1: "inclusionai/ling-3.0-flash-vl:free",
  DOTS_3_NOTE_PREVIEW: "dots-studio/dots-3-note-preview:free",

  THINKING_MACHINES_INKLING_SMALL: "thinkingmachines/inkling-small:free",
  THINKING_MACHINES_INKLING: "thinkingmachines/inkling:free",

  MINIMAX_M3: "minimax/minimax-m3:free",

  NEX_AGI_NEX_2_5_PRO: "nex-agi/nex-n2.5-pro:free",
} as const;

export type OpenRouterModel =
  (typeof OpenRouterModels)[keyof typeof OpenRouterModels];

export class OpenRouterLLMService extends OpenAICompatibleLLM<OpenRouterModel> {
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
}
