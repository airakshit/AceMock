import { DocumentForm } from "./DocumentForm";
import { YourDocuments } from "./YourDocuments";
import { createDocumentAction } from "../actions/create-document";
import { DocumentUploaderProvider } from "../uploads/document-uploader-provider";

export function DocumentView() {
  return (
    <DocumentUploaderProvider>
      <div className="space-y-8">
        <section className="space-y-4">
          <DocumentForm onSumbitAction={createDocumentAction} />
        </section>

        <YourDocuments />
      </div>
    </DocumentUploaderProvider>
  );
}
