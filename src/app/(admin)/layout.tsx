import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/layouts/components/AdminSidebar";
import { MobileSidebarTrigger } from "@/components/layouts/components/MobileSidebarTrigger";
import { QuestionInteractionsProvider } from "@/features/shared/components/question-card/QuestionInteractionsContext";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/signin");
  }

  const role = (session.user as { role?: string })?.role;
  if (role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <QuestionInteractionsProvider>
        <AdminSidebar />
        <SidebarInset className="h-svh overflow-y-auto">
          <MobileSidebarTrigger />
          <div className="flex min-h-full flex-1 flex-col">{children}</div>
        </SidebarInset>
      </QuestionInteractionsProvider>
    </SidebarProvider>
  );
}
