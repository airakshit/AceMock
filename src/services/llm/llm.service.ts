import { Groq } from "groq-sdk";
import { BaseLLMService } from "./base-llm.service";

enum GroqModels {
  QWEN_VISION_MODEL = "qwen/qwen3.6-27b",
  LLAMA_VISION_11B = "llama-3.2-11b-vision-preview",
  LLAMA_VISION_90B = "llama-3.2-90b-vision-preview",
  GPT_OSS_120B = "openai/gpt-oss-120b",
  GPT_OSS_20B = "openai/gpt-oss-20b",
  LLAMA_8B_INSTANT = "llama-3.1-8b-instant",
  LLAMA_70B_VERSATILE = "llama-3.3-70b-versatile",
}

class GroqLLMService extends BaseLLMService<GroqModels> {
  private _client: Groq;

  constructor(apiKey: string, model: GroqModels) {
    super(apiKey, model);
    this._client = new Groq({ apiKey: apiKey });
  }

  async call(
    prompt: string,
    model?: GroqModels,
    imageUrls?: string[],
  ): Promise<string | null> {
    const hasImages = imageUrls && imageUrls.length > 0;

    const content: any = hasImages
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

    const response = await this._client.chat.completions.create({
      model: model || this.model,
      messages: [
        {
          role: "user",
          content: content,
        },
      ],
    });

    return response.choices[0].message.content;
  }
}

export { GroqLLMService, GroqModels };
