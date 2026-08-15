export interface CustomTestOption {
    id: string;
    label: string;
    description: string;
    value: string | number | boolean;
}

export interface CustomTestDraft {
    id: string;
    title: string;
    subject: string;
    questionCount: number;
    durationMinutes: number;
    difficulty: "Easy" | "Medium" | "Hard";
    topics: string[];
}

export interface CustomTestsData {
    subjects: string[];
    topicsBySubject: Record<string, string[]>;
    recentDrafts: CustomTestDraft[];
}
