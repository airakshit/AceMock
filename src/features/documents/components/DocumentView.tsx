import { DocumentsNav } from "./DocumentsNav";
import { YourDocuments } from "./YourDocuments";
import { DocumentUploaderProvider } from "../uploads/document-uploader-provider";

export function DocumentView() {
  return (
    <DocumentUploaderProvider>
      <div className="space-y-6">
        <DocumentsNav />
        <YourDocuments />
      </div>
    </DocumentUploaderProvider>
  );
}
