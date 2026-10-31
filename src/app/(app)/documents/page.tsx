import { headers } from "next/headers";

import { PageHeader } from "@/components/patterns/page-header";
import { DocumentView } from "@/features/documents/components/DocumentView";
import { documentsService } from "@/features/documents/service";
import { auth } from "@/lib/auth/auth";

export default async function DocumentPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // The list is rendered from a server snapshot on first paint; the client
  // only refetches on explicit refresh/upload-completion events.
  const initialDocuments = session
    ? (await documentsService.searchUserDocuments(session.user.id)).documents
    : [];

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Documents"
        description="Turn your documents into tailored practice sets."
      />
      <DocumentView initialDocuments={initialDocuments} />
    </div>
  );
}
