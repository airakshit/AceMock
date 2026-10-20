import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processDocument } from "@/inngest/v1/functions/process-document";
import { extractQuestions } from "@/inngest/v1/functions/extract-questions";
import { ocrPage } from "@/inngest/v1/functions/ocr-page";
import { classifyQuestions } from "@/inngest/v1/functions/classify-questions";
import { extractFigures } from "@/inngest/v1/functions/extract-figures";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processDocument,
    extractQuestions,
    ocrPage,
    extractFigures,
    classifyQuestions,
  ],
});
