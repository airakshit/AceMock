import { Groq } from "groq-sdk";

enum GroqModels {
  QWEN_VISION_MODEL = "qwen/qwen3.6-27b",
  GPT_OSS_120B = "openai/gpt-oss-120b",
  GPT_OSS_20B = "openai/gpt-oss-20b",
  LLAMA_8B_INSTANT = "llama-3.1-8b-instant",
  LLAMA_70B_VERSATILE = "llama-3.3-70b-versatile",
}

class GroqLLMService {
  private _client: Groq;
  private _apiKey: string;
  model: GroqModels;

  constructor(apiKey: string, model: GroqModels) {
    ((this._apiKey = apiKey), (this.model = model));
    this._client = new Groq({ apiKey: apiKey });
  }

  async call(
    prompt: string,
    model?: GroqModels,
    imageUrls?: string[],
  ): Promise<string | null> {
    const content: any = [{ type: "text", text: prompt }];

    if (imageUrls) {
      imageUrls.forEach((value, index) => {
        content.push({ type: "image_url", image_url: value });
      });
    }

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
