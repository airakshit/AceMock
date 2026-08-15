import { CustomView } from "@/features/custom/components/CustomView";
import { AppHeader } from "@/features/shell/components/AppHeader";

export default function CustomPage() {
    return (
        <>
            <AppHeader
                title="Custom"
                description="Build tests tailored to your study plan."
            />
            <div className="flex-1 overflow-auto p-4 md:p-6">
                <CustomView />
            </div>
        </>
    );
}
