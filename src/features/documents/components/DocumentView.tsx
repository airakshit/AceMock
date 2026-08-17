
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { DocumentForm } from "./DocumentForm";
import { MoreInformation } from "@/components/shared/MoreInformation";
import { MORE_INFORMATION_NEW_DOCUMENT } from "../constants";
import { createNewDocumentAction } from "@/features/documents/actions";


export function DocumentView() {
    return (
        <div className="space-y-8">
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <h3 className={typography.sectionTitle}>
                        Bring Your Own Questions!
                    </h3>

                    <MoreInformation
                        content={`${MORE_INFORMATION_NEW_DOCUMENT}`}
                    />
                </div>

                <DocumentForm onSumbitAction={createNewDocumentAction} />
            </section>

            <section className="space-y-4">
                <h3 className={typography.sectionTitle}>Recent drafts</h3>

                <div
                    className={cn(
                        "rounded-xl border border-dashed border-border px-4 py-8 text-center",
                        typography.bodyMuted,
                    )}
                >
                    No drafts yet. Start by choosing a subject above.
                </div>
            </section>
        </div>
    );
}
