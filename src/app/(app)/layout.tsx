import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layouts/components/AppSidebar";

export default function AppLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-h-svh">
                <div className="flex min-h-svh flex-1 flex-col">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
