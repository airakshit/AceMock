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
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Administrator Privileges Active
              </h2>
              <p className="text-xs text-muted-foreground">
                All server actions and routes within this workspace enforce strict administrator role verification.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ADMIN_MODULES.map((mod) => (
            <Link key={mod.href} href={mod.href} className="group">
              <Card className="h-full border-border/70 hover:border-primary/50 hover:shadow-xs transition-all duration-150">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <mod.icon className="size-4.5" />
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold tracking-wide">
                      {mod.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors pt-2">
                    {mod.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CardDescription className="text-xs line-clamp-2">
                    {mod.description}
                  </CardDescription>
                  <div className="flex items-center text-xs font-medium text-primary gap-1 pt-1">
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
