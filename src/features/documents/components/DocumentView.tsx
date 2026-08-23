import { DocumentForm } from "./DocumentForm";
import { YourDocuments } from "./YourDocuments";
import { createNewDocumentAction } from "../actions/create-document";

export function DocumentView() {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <DocumentForm onSumbitAction={createNewDocumentAction} />
      </section>

      <YourDocuments />
    </div>
  );
}
