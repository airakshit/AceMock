import { AppHeader } from "@/components/layouts/components/AppHeader";
import { BookmarksView } from "@/features/questions/components/bookmarks";

export const metadata = {
  title: "Bookmarks | AceMock",
  description: "Questions you've saved for later review.",
};

export default function BookmarksPage() {
  return (
    <>
      <AppHeader
        title="Bookmarks"
        description="Questions you've saved for later review."
      />
      <div className="flex-1 p-4 md:p-6">
        <BookmarksView />
      </div>
    </>
  );
}
