import { PageHeader } from "@/components/patterns/page-header";
import { BookmarksView } from "@/features/questions/components/bookmarks";

export const metadata = {
  title: "Bookmarks | AceMock",
  description: "Questions you've saved for later review.",
};

export default function BookmarksPage() {
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Bookmarks"
        description="Drill saved questions by subject, with or without solutions."
      />
      <BookmarksView />
    </div>
  );
}
