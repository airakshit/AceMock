import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layouts/components/AppSidebar";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-y-auto">
        <div className="flex min-h-full flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
