import "dotenv/config";
import { inngest } from "@/inngest/client";

async function main() {
  const documentId = process.argv[2];
  const userId = process.argv[3];

  if (!documentId || !userId) {
    console.error("Usage: npx tsx scripts/test-process-document.ts <documentId> <userId>");
    process.exit(1);
  }

  console.log(`Sending Inngest event 'document/process' for documentId=${documentId}, userId=${userId}...`);

  const result = await inngest.send({
    name: "document/process",
    data: {
      documentId,
      userId,
    },
  });

  console.log("Event dispatched successfully:", result);
}

main().catch((err) => {
  console.error("Error dispatching event:", err);
  process.exit(1);
});
