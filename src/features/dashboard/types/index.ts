export interface UserMockTestMetric {
    id: string;
    label: string;
    value: string | number;
    hint?: string;
    accent?: "default" | "success" | "info" | "warning";
}

export interface DashboardMetrics {
    hasAttemptedTests: boolean;
    metrics: UserMockTestMetric[];
}

export interface PopularMockTest {
    id: string;
    title: string;
    durationMinutes: number;
    totalQuestions: number;
    subject: string;
    difficulty: "Easy" | "Medium" | "Hard";
    isPopular?: boolean;
}

export interface DashboardData {
    metrics: DashboardMetrics;
    popularMockTests: PopularMockTest[];
}
