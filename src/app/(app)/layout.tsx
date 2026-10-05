import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layouts/components/AppSidebar";
import { MobileSidebarTrigger } from "@/components/layouts/components/MobileSidebarTrigger";
import { QuestionInteractionsProvider } from "@/features/shared/components/question-card/QuestionInteractionsContext";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SidebarProvider defaultOpen={false}>
      <QuestionInteractionsProvider>
        <AppSidebar />
        <SidebarInset className="h-svh overflow-y-auto">
          <MobileSidebarTrigger />
          <div className="flex min-h-full flex-1 flex-col">{children}</div>
        </SidebarInset>
      </QuestionInteractionsProvider>
    </SidebarProvider>
  );
}
