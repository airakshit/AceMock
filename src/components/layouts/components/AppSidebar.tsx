"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_NAME, APP_NAV_ITEMS } from "@/components/layouts/constants";
import { SidebarThemeToggle } from "@/components/layouts/components/SidebarThemeToggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function AppSidebar() {
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar overflow-hidden">
      {/* Brand Header — h-14 matches AppHeader height */}
      <SidebarHeader className="h-14 border-b border-sidebar-border/60 p-0 overflow-hidden shrink-0">
        <Link
          href="/dashboard"
          onClick={handleNavClick}
          className="flex h-full w-full items-center px-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/40"
        >
          {/* Logo container: exactly size-10 (40px) centered in 56px rail */}
          <div className="flex size-10 shrink-0 items-center justify-center">
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-foreground text-background shadow-xs">
              <Layers className="size-4 text-background" />
            </div>
          </div>

          {/* Brand Title: smooth width/opacity reveal */}
          <div
            className={cn(
              "flex flex-col min-w-0 overflow-hidden whitespace-nowrap pl-1 transition-all duration-200 ease-out",
              isExpanded || isMobile ? "max-w-44 opacity-100" : "max-w-0 opacity-0 pointer-events-none",
            )}
          >
            <span className="truncate text-xs font-bold tracking-tight text-foreground uppercase">
              {APP_NAME}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal tracking-tight truncate">
              Test & Analytics
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Navigation Items */}
      <SidebarContent className="p-2 space-y-1 overflow-x-hidden overflow-y-auto no-scrollbar">
        {APP_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`);

          const buttonContent = (
            <Link
              href={item.href}
              onClick={handleNavClick}
              className={cn(
                "group flex h-10 w-full items-center rounded-lg text-xs font-medium transition-colors duration-150",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground font-semibold shadow-2xs border border-sidebar-border/60"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
              )}
            >
              {/* Centralized Icon Wrapper: exactly size-10 (40px) */}
              <div className="flex size-10 shrink-0 items-center justify-center">
                <item.icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
              </div>

              {/* Text Label: smoothly expands without wrapping */}
              <div
                className={cn(
                  "flex flex-1 items-center justify-between min-w-0 overflow-hidden whitespace-nowrap pr-2.5 transition-all duration-200 ease-out",
                  isExpanded ? "max-w-44 opacity-100" : "max-w-0 opacity-0 pointer-events-none",
                )}
              >
                <span className="truncate">{item.title}</span>
                {isActive && (
                  <span className="size-1.5 rounded-full bg-foreground shrink-0 ml-2" />
                )}
              </div>
            </Link>
          );

          // Show tooltip only when collapsed and on desktop
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
      </SidebarContent>

      {/* Footer Theme Selector */}
      <SidebarFooter className="border-t border-sidebar-border/60 p-2 shrink-0 overflow-hidden">
        <SidebarThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
