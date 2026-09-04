export interface ILLMService<TModel extends string = string> {
  model: TModel;
  call(
    prompt: string,
    model?: TModel,
    imageUrls?: string[],
  ): Promise<string | null>;
}

export abstract class BaseLLMService<TModel extends string = string>
  implements ILLMService<TModel>
{
  protected apiKey: string;
  public model: TModel;

  constructor(apiKey: string, defaultModel: TModel) {
    this.apiKey = apiKey;
    this.model = defaultModel;
  }

  abstract call(
    prompt: string,
    model?: TModel,
    imageUrls?: string[],
  ): Promise<string | null>;
}
