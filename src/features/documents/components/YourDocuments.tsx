import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";

export function YourDocuments() {
    return (
        <section className="space-y-4">
            <h3 className={typography.sectionTitle}>Your Documents</h3>

            <div
                className={cn(
                    "rounded-xl border border-dashed border-border px-4 py-8 text-center",
                    typography.bodyMuted,
                )}
            >
                No documents yet. Start by creating a document.
            </div>
        </section>
    );
}
