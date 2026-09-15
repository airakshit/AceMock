export const TEST_JSON_SCHEMA = {
  type: "object",
  properties: {
    answer: {
      type: "string",
      description: "The main answer to the user's question.",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "The model's confidence in the answer, from 0 to 1.",
    },
    key_points: {
      type: "array",
      items: {
        type: "string",
      },
      description: "Important points supporting or explaining the answer.",
    },
  },
  required: ["answer", "confidence", "key_points"],
  additionalProperties: false,
};
