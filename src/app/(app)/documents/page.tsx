import { PageHeader } from "@/components/patterns/page-header";
import { DocumentView } from "@/features/documents/components/DocumentView";

export default function DocumentPage() {
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Documents"
        description="Turn your documents into tailored practice sets."
      />
      <DocumentView />
    </div>
  );
}
