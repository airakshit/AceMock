import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processDocument } from "@/inngest/functions/process-document";
import { extractQuestions } from "@/inngest/functions/extract-questions/func";
import { ocrPage } from "@/inngest/functions/extract-questions/ocr-page";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processDocument, extractQuestions, ocrPage],
});
