import { BaseLLMProvider } from "./base";

export const GroqModels = {
  QWEN_VISION_MODEL: "qwen/qwen3.6-27b",
  LLAMA_VISION_11B: "llama-3.2-11b-vision-preview",
  LLAMA_VISION_90B: "llama-3.2-90b-vision-preview",
  GPT_OSS_120B: "openai/gpt-oss-120b",
  GPT_OSS_20B: "openai/gpt-oss-20b",
  LLAMA_8B_INSTANT: "llama-3.1-8b-instant",
  LLAMA_70B_VERSATILE: "llama-3.3-70b-versatile",
} as const;

export type GroqModel = (typeof GroqModels)[keyof typeof GroqModels];

export class GroqLLMService extends BaseLLMProvider<GroqModel> {
  constructor(apiKey: string, defaultModel: GroqModel = "openai/gpt-oss-120b") {
    super({
      providerName: "Groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey,
      availableModels: Object.values(GroqModels),
      defaultModel,
    });
  }
}
