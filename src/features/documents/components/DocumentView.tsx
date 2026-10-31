import { DocumentsNav } from "./DocumentsNav";
import { YourDocuments } from "./YourDocuments";
import { DocumentUploaderProvider } from "../uploads/document-uploader-provider";
import type { DocumentSearchData } from "../dto/projections";

interface DocumentViewProps {
  /** Server-rendered first snapshot of the user's documents. */
  initialDocuments?: DocumentSearchData[];
}

export function DocumentView({ initialDocuments }: DocumentViewProps) {
  return (
    <DocumentUploaderProvider>
      <div className="space-y-6">
        <DocumentsNav />
        <YourDocuments initialDocuments={initialDocuments} />
      </div>
    </DocumentUploaderProvider>
  );
}
