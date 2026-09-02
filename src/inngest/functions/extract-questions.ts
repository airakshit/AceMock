import { inngest } from "../client";

export interface ExtractDocumentQuestionEventData {
  userId: string;
  documentId: string;
}

const extractQuestions = inngest.createFunction(
  {
    id: "extract-questions-from-document",
    triggers: { event: "documents/extract" },
  },

  async ({ step, logger }) => {
    // step.run()
  },
);
