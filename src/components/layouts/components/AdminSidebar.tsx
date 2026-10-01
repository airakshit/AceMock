"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { ADMIN_NAV_ITEMS, APP_NAME } from "@/components/layouts/constants";
import { SidebarThemeToggle } from "@/components/layouts/components/SidebarThemeToggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile, setIsHovered, state } = useSidebar();
  const isExpanded = state === "expanded" || isMobile;

  // Collapse sidebar whenever the route changes
  useEffect(() => {
    setIsHovered(false);
  }, [pathname, setIsHovered]);

  const handleNavClick = () => {
    setIsHovered(false);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden border-r border-sidebar-border/70 bg-sidebar"
    >
      {/* Brand Header */}
      <SidebarHeader className="h-14 shrink-0 overflow-hidden border-b border-sidebar-border/60 p-0">
        <Link
          href="/admin"
          onClick={handleNavClick}
          className="group/brand flex h-full w-full items-center px-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/40"
        >
          {/* Logo container: exactly size-10 (40px) centered in 56px rail */}
          <div className="flex size-10 shrink-0 items-center justify-center">
            <div className="flex size-8 items-center justify-center rounded-[10px] bg-brand-gradient text-white shadow-sm ring-1 ring-inset ring-white/20 transition-transform duration-200 group-hover/brand:scale-105">
              <ShieldCheck className="size-4" />
            </div>
          </div>

          {/* Brand Title */}
          <div
            className={cn(
              "flex min-w-0 flex-col overflow-hidden whitespace-nowrap pl-1 transition-all duration-200 ease-out",
              isExpanded || isMobile
                ? "max-w-44 opacity-100"
                : "pointer-events-none max-w-0 opacity-0",
            )}
          >
            <span className="flex items-center gap-1.5 truncate font-heading text-sm font-bold tracking-tight text-foreground">
              Admin
              <span className="rounded-full bg-brand-muted px-1.5 py-px font-mono text-[9px] font-semibold tracking-wide text-brand">
                {APP_NAME}
              </span>
            </span>
            <span className="truncate text-[10px] font-medium tracking-wide text-muted-foreground">
              Control Console
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Navigation Items */}
      <SidebarContent className="p-2 space-y-1 overflow-x-hidden overflow-y-auto no-scrollbar">
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(`${item.href}/`)) ||
            (item.href === "/admin" && pathname === "/admin");

          const buttonContent = (
            <Link
              href={item.href}
              onClick={handleNavClick}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex h-10 w-full items-center rounded-lg text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-brand-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
              )}
            >
              {isActive ? (
                <span className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand" />
              ) : null}

              {/* Centralized Icon Wrapper */}
              <div className="flex size-10 shrink-0 items-center justify-center">
                <item.icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive
                      ? "text-brand"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
              </div>

              {/* Text Label */}
              <div
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-between overflow-hidden whitespace-nowrap pr-2.5 transition-all duration-200 ease-out",
                  isExpanded
                    ? "max-w-44 opacity-100"
                    : "pointer-events-none max-w-0 opacity-0",
                )}
              >
                <span className="truncate">{item.title}</span>
              </div>
            </Link>
          );

          if (!isExpanded && !isMobile) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={buttonContent} />
                <TooltipContent side="right" sideOffset={12} className="text-xs font-medium">
                  {item.title}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.href}>{buttonContent}</div>;
        })}

        {/* Back to App Link */}
        <div className="pt-2 border-t border-sidebar-border/40 mt-2">
          {(() => {
            const backLink = (
              <Link
                href="/dashboard"
                onClick={handleNavClick}
                className="group flex h-9 w-full items-center rounded-lg text-xs font-medium text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground transition-colors duration-150"
              >
                <div className="flex size-10 shrink-0 items-center justify-center">
                  <ArrowLeft className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div
                  className={cn(
                    "flex flex-1 items-center min-w-0 overflow-hidden whitespace-nowrap pr-2.5 transition-all duration-200 ease-out",
                    isExpanded ? "max-w-44 opacity-100" : "max-w-0 opacity-0 pointer-events-none",
                  )}
                >
                  <span className="truncate text-[11px]">Back to App</span>
                </div>
              </Link>
            );

            if (!isExpanded && !isMobile) {
              return (
                <Tooltip>
                  <TooltipTrigger render={backLink} />
                  <TooltipContent side="right" sideOffset={12} className="text-xs font-medium">
                    Back to App
                  </TooltipContent>
                </Tooltip>
              );
            }
            return backLink;
          })()}
        </div>
      </SidebarContent>

      {/* Footer Theme Selector */}
      <SidebarFooter className="border-t border-sidebar-border/60 p-2 shrink-0 overflow-hidden">
        <SidebarThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
