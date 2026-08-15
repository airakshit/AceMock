import { ClipboardList, LayoutDashboard, SlidersHorizontal } from "lucide-react";

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
        title: "Custom",
        href: "/custom",
        icon: SlidersHorizontal,
    },
];

export const APP_NAME = "Ace Mock";
