// import "dotenv/config";
// import { describe, expect, it } from "vitest";
// import { GroqModels, GroqLLMService } from "../src/services/llm/groq.service";

// describe("GroqLLMService", () => {
//   const apiKey = process.env.GROQ_API_KEY!;

//   describe("constructor", () => {
//     it("should call the model", async () => {
//       const service = new GroqLLMService(apiKey);
//       const response = await service.call("What is life?");
//       console.log(response);
//     });

//     it("should allow a custom default model", () => {
//       const service = new GroqLLMService(apiKey, GroqModels.GPT_OSS_120B);

//       expect(service.model).toBe(GroqModels.GPT_OSS_120B);
//     });

//     it("should configure all supported Groq models", () => {
//       const service = new GroqLLMService(apiKey);
//       expect(service.availableModels).toEqual(Object.values(GroqModels));
//     });
//   });
// });
