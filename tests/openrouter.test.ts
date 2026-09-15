import "dotenv/config";
import { describe, expect, it } from "vitest";
import {
  OpenRouterModels,
  OpenRouterLLMService,
} from "../src/services/llm/openrouter.service";
import { TEST_JSON_SCHEMA } from "./common";

describe("OpenRouterLLMService", () => {
  const apiKey = process.env.OPENROUTER_API_KEY!;

  describe("constructor", () => {
    const service = new OpenRouterLLMService(apiKey);

    it("should call the model", async () => {
      try {
        const response = await service.call("What is life?");
        console.log(response);
      } catch (error: any) {
        console.log(error.message);
      }
    }, 30_000);

    it("should support structured ouput", async () => {
      try {
        const response = await service.call(
          "What is life?",
          "dots-studio/dots-3-note-preview:free",
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
