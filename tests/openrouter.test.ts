import "dotenv/config";
import { describe, expect, it } from "vitest";
import {
  OpenRouterModels,
  OpenRouterLLMService,
} from "../src/services/llm/openrouter.service";

describe("OpenRouterLLMService", () => {
  const apiKey = process.env.OPENROUTER_API_KEY!;

  describe("constructor", () => {
    it("should call the model", async () => {
      const service = new OpenRouterLLMService(apiKey);
      try {
        const response = await service.call("What is life?");
        console.log(response);
      } catch (error: any) {
        console.log(error.message);
      }
    }, 30_000);

    it("should allow a custom default model", () => {
      const service = new OpenRouterLLMService(
        apiKey,
        OpenRouterModels.DOTS_3_NOTE_PREVIEW,
      );

      expect(service.model).toBe(OpenRouterModels.DOTS_3_NOTE_PREVIEW);
    });

    it("should configure all supported OPENROUTER models", () => {
      const service = new OpenRouterLLMService(apiKey);
      expect(service.availableModels).toEqual(Object.values(OpenRouterModels));
    });
  });
});
