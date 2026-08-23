import { AuthLayout } from "@/components/layouts/auth-layout";

export default function AuthRouteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AuthLayout>{children}</AuthLayout>;
}
