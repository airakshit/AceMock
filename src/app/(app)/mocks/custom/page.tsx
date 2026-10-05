import { Sparkles } from "lucide-react";

import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { MocksNav } from "@/features/mocks/components/MocksNav";

export const metadata = {
  title: "Custom Tests | AceMock",
  description: "Assemble practice sets around your weak areas — coming soon.",
};

export default function MocksCustomPage() {
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Custom Tests"
        description="Assemble practice sets around your weak areas."
      />
      <MocksNav active="custom" />
      <EmptyState
        icon={Sparkles}
        title="Custom tests are coming soon"
        description="Pick subjects, chapters, and difficulty to build a test tailored to you. This section isn't implemented yet."
      />
    </div>
  );
}
