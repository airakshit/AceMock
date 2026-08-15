import type { DashboardData } from "./types";

/** Empty history — shows the onboarding message in metrics section. */
export const dashboardMockData: DashboardData = {
    metrics: {
        hasAttemptedTests: true,
        metrics: [],
    },
    popularMockTests: [
        {
            id: "pop-1",
            title: "IOE Full Mock Test 2025 — Set A",
            durationMinutes: 180,
            totalQuestions: 140,
            subject: "Full Mock",
            difficulty: "Hard",
            isPopular: true,
        },
        {
            id: "pop-2",
            title: "Physics Chapterwise — Mechanics",
            durationMinutes: 60,
            totalQuestions: 45,
            subject: "Physics",
            difficulty: "Medium",
            isPopular: true,
        },
        {
            id: "pop-3",
            title: "Chemistry — Organic Reactions Drill",
            durationMinutes: 45,
            totalQuestions: 40,
            subject: "Chemistry",
            difficulty: "Medium",
            isPopular: true,
        },
        {
            id: "pop-4",
            title: "Mathematics — Calculus Sprint",
            durationMinutes: 50,
            totalQuestions: 35,
            subject: "Mathematics",
            difficulty: "Hard",
            isPopular: true,
        },
        {
            id: "pop-5",
            title: "English Aptitude — Quick Practice",
            durationMinutes: 30,
            totalQuestions: 30,
            subject: "English",
            difficulty: "Easy",
            isPopular: true,
        },
        {
            id: "pop-6",
            title: "IOE Full Mock Test 2024 — Set B",
            durationMinutes: 180,
            totalQuestions: 140,
            subject: "Full Mock",
            difficulty: "Hard",
            isPopular: true,
        },
        {
            id: "pop-7",
            title: "Physics — Electricity & Magnetism",
            durationMinutes: 55,
            totalQuestions: 42,
            subject: "Physics",
            difficulty: "Medium",
        },
        {
            id: "pop-8",
            title: "Mixed Subject Mini Mock",
            durationMinutes: 40,
            totalQuestions: 50,
            subject: "Mixed",
            difficulty: "Easy",
        },
    ],
};

/** Use this variant locally to preview the metrics grid with history data. */
export const dashboardMockDataWithHistory: DashboardData = {
    metrics: {
        hasAttemptedTests: true,
        metrics: [
            {
                id: "tests-taken",
                label: "Tests Taken",
                value: 12,
                hint: "Across all subjects",
                accent: "info",
            },
            {
                id: "average-score",
                label: "Average Score",
                value: "68%",
                hint: "Last 5 attempts",
                accent: "success",
            },
            {
                id: "best-rank",
                label: "Best Rank",
                value: "#24",
                hint: "Among all mock takers",
                accent: "warning",
            },
        ],
    },
    popularMockTests: dashboardMockData.popularMockTests,
};
