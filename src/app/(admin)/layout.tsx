import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/layouts/components/AdminSidebar";

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
      <AdminSidebar />
      <SidebarInset className="h-svh overflow-y-auto">
        <div className="flex min-h-full flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
