import { DocumentView } from "@/features/documents/components/DocumentView";
import { AppHeader } from "@/components/layouts/components/AppHeader";

export default function DocumentPage() {
    return (
        <>
            <AppHeader
                title="Documents"
                description="Build tests tailored to your study plan."
            />
            <div className="flex-1 overflow-auto p-4 md:p-6">
                <DocumentView />
            </div>
        </>
    );
}
