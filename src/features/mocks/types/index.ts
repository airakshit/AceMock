export interface MockTest {
    id: string;
    title: string;
    durationMinutes: number;
    totalQuestions: number;
    totalMarks: number;
    subject: string;
    difficulty: "Easy" | "Medium" | "Hard";
    description?: string;
}

export interface MockTestsData {
    tests: MockTest[];
}
