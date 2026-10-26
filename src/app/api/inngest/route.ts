import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processDocument } from "@/inngest/functions/v1/process-document";
import { extractQuestions } from "@/inngest/functions/v1/extract-questions";
import { ocrPage } from "@/inngest/functions/v1/ocr-page";
import { classifyQuestions } from "@/inngest/functions/v1/classify-questions";
import { extractFigures } from "@/inngest/functions/v1/extract-figures";
import { cleanupStaleUploads } from "@/inngest/functions/v1/cleanup-stale-uploads";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processDocument,
    extractQuestions,
    ocrPage,
    extractFigures,
    classifyQuestions,
    cleanupStaleUploads,
  ],
});
