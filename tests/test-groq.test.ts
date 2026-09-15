import "dotenv/config";
import { describe, expect, it } from "vitest";
import { GroqModels, GroqLLMService } from "../src/services/llm/groq.service";
import { TEST_JSON_SCHEMA } from "./common";

describe("GroqLLMService", () => {
  const apiKey = process.env.GROQ_API_KEY!;

  describe("constructor", () => {
    const service = new GroqLLMService(apiKey);

    it("should call the model", async () => {
      const response = await service.call("What is life?");
      console.log(response);
    });

    it("should support structured ouput", async () => {
      try {
        const response = await service.call(
          "What is life?",
          "openai/gpt-oss-120b",
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
      const service = new GroqLLMService(apiKey, GroqModels.GPT_OSS_120B);

      expect(service.model).toBe(GroqModels.GPT_OSS_120B);
    });

    it("should configure all supported Groq models", () => {
      const service = new GroqLLMService(apiKey);
      expect(service.availableModels).toEqual(Object.values(GroqModels));
    });
  });
});
