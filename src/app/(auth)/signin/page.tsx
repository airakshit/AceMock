"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import SignIn from "./_components/sign-in";
import { SignUp } from "./_components/sign-up";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const TAB_OPTIONS = ["signin", "signup"] as const;

type TabValue = (typeof TAB_OPTIONS)[number];

function SignInPageContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Manage tab state locally for instant, stable transition feedback
    const [activeTab, setActiveTab] = useState<TabValue>(() => {
        const tabParam = searchParams.get("tab");
        return tabParam === "signup" ? "signup" : "signin";
    });

    // Synchronize tabParam updates to local state (e.g., if user clicks back/forward)
    useEffect(() => {
        const tabParam = searchParams.get("tab");
        const currentTab = tabParam === "signup" ? "signup" : "signin";
        setActiveTab(currentTab);
    }, [searchParams]);

    const handleTabChange = (value: string) => {
        const nextTab = value === "signup" ? "signup" : "signin";
        setActiveTab(nextTab); // Immediate state update for instant UI feedback

        // Sync URL in background. Scroll: false prevents the page from jumping to top
        const search = new URLSearchParams(Array.from(searchParams.entries()));
        search.set("tab", nextTab);
        router.replace(`${pathname}?${search.toString()}`, { scroll: false });
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-background text-foreground flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
            {/* Decorative background glow circles */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-rose-500/10 dark:bg-rose-500/5 blur-[100px] pointer-events-none" />

            <div className="w-full max-w-2xl mx-auto z-10">
                {/* Header section with badge */}
                <div className="mx-auto flex flex-col items-center text-center px-4 mb-6 sm:mb-8">
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                        Ace <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 bg-clip-text text-transparent">IOE Entrance</span>
                    </h1>
                    <p className="mt-2.5 text-xs sm:text-sm text-muted-foreground max-w-sm sm:max-w-md leading-relaxed">
                        Free high-quality mock tests & subject-wise practice for BE/B.Arch entrance exams.
                    </p>
                </div>

                <div className="w-full">
                    <Tabs
                        value={activeTab}
                        onValueChange={handleTabChange}
                        className="w-full"
                    >
                        {/* Custom visual segmented tab switcher */}
                        <div className="px-4 py-2 max-w-md mx-auto">
                            <TabsList className="relative flex w-full gap-1 rounded-2xl bg-muted p-1 text-sm border border-border shadow-inner">
                                {/* Sliding pill background */}
                                <div
                                    className={cn(
                                        "absolute top-1 bottom-1 left-1 rounded-xl bg-card shadow-sm transition-all duration-300 ease-out",
                                        activeTab === "signin"
                                            ? "w-[calc(50%-4px)] translate-x-0"
                                            : "w-[calc(50%-4px)] translate-x-[100%]"
                                    )}
                                />

                                <TabsTrigger
                                    className={cn(
                                        "relative z-10 flex-1 min-h-10 rounded-xl px-4 py-2 text-sm sm:text-base font-semibold transition-all duration-200 focus-visible:outline-hidden cursor-pointer flex items-center justify-center gap-2",
                                        activeTab === "signin"
                                            ? "text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                    value="signin"
                                >
                                    Sign In
                                </TabsTrigger>

                                <TabsTrigger
                                    className={cn(
                                        "relative z-10 flex-1 min-h-10 rounded-xl px-4 py-2 text-sm sm:text-base font-semibold transition-all duration-200 focus-visible:outline-hidden cursor-pointer flex items-center justify-center gap-2",
                                        activeTab === "signup"
                                            ? "text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                    value="signup"
                                >
                                    Sign Up
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Content area */}
                        <div className="mt-4 sm:mt-6">
                            <TabsContent
                                value="signin"
                                className="w-full focus-visible:outline-hidden"
                            >
                                <SignIn />
                            </TabsContent>
                            <TabsContent
                                value="signup"
                                className="w-full focus-visible:outline-hidden"
                            >
                                <SignUp />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                {/* Features & stats footer */}
                <div className="mt-8 text-center px-4">
                    <p className="text-xs text-muted-foreground font-medium">
                        Designed for IOE aspirants (BE/B.Arch) in Nepal
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center items-center gap-x-5 gap-y-2.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Subject-wise & Full Mock Tests</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Real Exam Timing & Layout</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>100% Free Forever</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-muted-foreground font-medium">Loading auth portal...</p>
                </div>
            </div>
        }>
            <SignInPageContent />
        </Suspense>
    );
}
