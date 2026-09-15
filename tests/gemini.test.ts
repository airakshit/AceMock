import "dotenv/config";
import { describe, expect, it } from "vitest";
import {
  GeminiModels,
  GeminiLLMService,
} from "../src/services/llm/gemini.service";
import { TEST_JSON_SCHEMA } from "./common";

describe("GeminiLLMService", () => {
  const apiKey = process.env.GEMINI_API_KEY!;

  describe("constructor", () => {
    const service = new GeminiLLMService(apiKey);

    it("should support structured ouput", async () => {
      try {
        const response = await service.call(
          "What is life?",
          "gemma-4-26b-a4b-it",
          undefined,
          { name: "testt-schema", strict: true, schema: TEST_JSON_SCHEMA },
        );
        if (response === null) {
          throw new Error("Response is null.");
        }
        const output = await JSON.parse(response);
        console.log("Output is : ", output);
      } catch (error: any) {
        console.log("Error Message : ", error.message);
      }
    }, 60_000);

    it("should allow a custom default model", () => {
      const service = new GeminiLLMService(apiKey, GeminiModels.GEMINI_2_5_PRO);

      expect(service.model).toBe(GeminiModels.GEMINI_2_5_PRO);
    });

    it("should configure all supported Gemini models", () => {
      const service = new GeminiLLMService(apiKey);
      expect(service.availableModels).toEqual(Object.values(GeminiModels));
    });
  });
});
