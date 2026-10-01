import Link from "next/link";
import { AppHeader } from "@/components/layouts/components/AppHeader";
import { HelpCircle, Database, ClipboardList, ShieldCheck, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Admin Console | AceMock",
  description: "Administrative console and management portal.",
};

const ADMIN_MODULES = [
  {
    title: "Question Authoring",
    description: "Author questions with LaTeX support, choices, hints, and explanations.",
    href: "/admin/questions",
    icon: HelpCircle,
    badge: "Authoring",
  },
  {
    title: "Questions Inspector",
    description: "Inspect ingested questions from documents, filter by chapter and document.",
    href: "/admin/questions/test",
    icon: Database,
    badge: "Database",
  },
  {
    title: "Mock Tests Manager",
    description: "Configure and assemble mock examinations, time limits, and question sets.",
    href: "/admin/mocks",
    icon: ClipboardList,
    badge: "Management",
  },
];

export default function AdminOverviewPage() {
  return (
    <>
      <AppHeader
        title="Admin Console"
        description="Comprehensive platform control for questions, examinations, and curricula."
      />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <div className="relative overflow-hidden rounded-2xl border border-brand/20 bg-brand-gradient-soft p-5">
          <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-40" />
          <div className="relative z-10 flex items-center gap-3.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm ring-1 ring-inset ring-white/20">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Administrator privileges active
              </h2>
              <p className="text-xs text-muted-foreground">
                All server actions and routes within this workspace enforce strict administrator role verification.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_MODULES.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className="h-full rounded-2xl border-border/80 shadow-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-brand/40 group-hover:shadow-card-hover group-active:translate-y-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-brand-muted text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                      <mod.icon className="size-5" />
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-semibold tracking-wide uppercase"
                    >
                      {mod.badge}
                    </Badge>
                  </div>
                  <CardTitle className="pt-2 text-sm font-semibold text-foreground transition-colors group-hover:text-brand">
                    {mod.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CardDescription className="line-clamp-2 text-xs">
                    {mod.description}
                  </CardDescription>
                  <div className="flex items-center gap-1 pt-1 text-xs font-medium text-brand">
                    <span>Manage</span>
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
