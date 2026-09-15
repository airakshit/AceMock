export interface StructuredJsonOptions {
  name: string;
  schema: Record<string, unknown>;
  strict: boolean;
}

export interface ProviderConfig<TModel extends string = string> {
  /** Human-readable name, only used in error messages */
  providerName: string;
  /** e.g. "https://api.groq.com/openai/v1" (trailing slash optional) */
  baseUrl: string;
  apiKey: string;
  /** Models this provider supports — used for validation + autocomplete */
  availableModels: readonly TModel[];
  /** Model used when `call()` is invoked without an explicit model */
  defaultModel: TModel;
  /** Extra headers merged into every request (e.g. OpenRouter's HTTP-Referer) */
  headers?: Record<string, string>;
  /** Abort requests after this many ms. Default: 60s */
  timeoutMs?: number;
}

export interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
}

export abstract class BaseLLMProvider<TModel extends string = string> {
  protected readonly providerName: string;
  protected readonly baseUrl: string;
  protected readonly apiKey: string;
  protected readonly headers: Record<string, string>;
  protected readonly timeoutMs: number | undefined;

  public readonly availableModels: readonly TModel[];
  public model: TModel;

  constructor(config: ProviderConfig<TModel>) {
    this.providerName = config.providerName;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.availableModels = config.availableModels;
    this.headers = config.headers ?? {};
    this.timeoutMs = config.timeoutMs ?? undefined;

    this.model = this.validateModel(config.defaultModel);
  }

  async call(
    prompt: string,
    model?: TModel,
    imageUrls?: string[],
    outputJson?: StructuredJsonOptions,
  ): Promise<string | null> {
    const resolvedModel = this.validateModel(model ?? this.model);
    const body = this.buildRequestBody(
      prompt,
      resolvedModel,
      imageUrls,
      outputJson,
    );

    const controller = new AbortController();
    const timeout = this.timeoutMs
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : undefined;

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    const data = (await res
      .json()
      .catch(() => null)) as ChatCompletionResponse | null;

    if (!res.ok) {
      this.handleErrors(res, data);
    }

    return data?.choices?.[0]?.message?.content ?? null;
  }

  protected handleErrors(res: Response, data: ChatCompletionResponse | null) {
    console.log(`Provider: ${this.providerName}, ErrorData: `, data);
    const message = data?.error?.message ?? res.statusText;
    throw new Error(
      `[${this.providerName}] request failed (${res.status}): ${message}`,
    );
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.headers,
    };
  }

  protected buildRequestBody(
    prompt: string,
    model: TModel,
    imageUrls?: string[],
    outputJson?: StructuredJsonOptions,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "user", content: this.buildContent(prompt, imageUrls) },
      ],
    };

    if (outputJson) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: outputJson.name,
          schema: outputJson.schema,
          strict: outputJson.strict,
        },
      };
    }

    return body;
  }

  protected buildContent(prompt: string, imageUrls?: string[]) {
    if (!imageUrls || imageUrls.length === 0) return prompt;

    return [
      { type: "text", text: prompt },
      ...imageUrls.map((url) => ({ type: "image_url", image_url: { url } })),
    ];
  }

  protected validateModel(model: TModel): TModel {
    if (!this.availableModels.includes(model)) {
      throw new Error(
        `[${this.providerName}] unknown model "${model}". Available: ${this.availableModels.join(", ")}`,
      );
    }
    return model;
  }
}
