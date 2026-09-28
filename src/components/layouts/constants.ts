import {
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  SlidersHorizontal,
} from "lucide-react";

import type { NavItem } from "./types";

export const APP_NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Mock Tests",
    href: "/mocks",
    icon: ClipboardList,
  },
  {
    title: "Documents",
    href: "/documents",
    icon: SlidersHorizontal,
  },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    title: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Questions",
    href: "/admin/questions",
    icon: HelpCircle,
  },
  {
    title: "Mock Tests",
    href: "/admin/mocks",
    icon: ClipboardList,
  },
];

export const APP_NAME = "Ace Mock";

