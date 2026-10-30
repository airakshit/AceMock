import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processDocument } from "@/inngest/functions/v1/process-document";
import { extractQuestions as extractQuestionsV1 } from "@/inngest/functions/v1/extract-questions";
import { ocrPage as ocrPageV1 } from "@/inngest/functions/v1/ocr-page";
import { classifyQuestions } from "@/inngest/functions/v1/classify-questions";
import { extractFigures } from "@/inngest/functions/v1/extract-figures";
import { cleanupStaleUploads } from "@/inngest/functions/v1/cleanup-stale-uploads";
import { extractQuestions as extractQuestionsV2 } from "@/inngest/functions/v2/extract-questions";
import { ocrPage as ocrPageV2 } from "@/inngest/functions/v2/ocr-page";
import { processDocument as processDocumentV2 } from "@/inngest/functions/v2/process-document";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processDocument,
    extractQuestionsV1,
    ocrPageV1,
    extractFigures,
    classifyQuestions,
    cleanupStaleUploads,

    // V2 functions
    extractQuestionsV2,
    ocrPageV2,
    processDocumentV2
  ],
});
