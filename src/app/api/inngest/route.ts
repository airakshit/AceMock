import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processDocument } from "@/inngest/functions/process-document";
import { extractQuestions } from "@/inngest/functions/extract-questions";
import { ocrPage } from "@/inngest/functions/ocr-page";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processDocument, extractQuestions, ocrPage],
});
