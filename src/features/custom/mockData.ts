import type { CustomTestsData } from "./types";

export const customMockData: CustomTestsData = {
    subjects: ["Physics", "Chemistry", "Mathematics", "English"],
    topicsBySubject: {
        Physics: ["Mechanics", "Electricity", "Optics", "Thermodynamics"],
        Chemistry: ["Organic", "Inorganic", "Physical", "Analytical"],
        Mathematics: ["Algebra", "Calculus", "Trigonometry", "Geometry"],
        English: ["Grammar", "Vocabulary", "Comprehension", "Synonyms"],
    },
    recentDrafts: [
        {
            id: "draft-1",
            title: "Physics — Mechanics Quick Drill",
            subject: "Physics",
            questionCount: 25,
            durationMinutes: 30,
            difficulty: "Medium",
            topics: ["Mechanics"],
        },
        {
            id: "draft-2",
            title: "Mixed Chemistry Revision",
            subject: "Chemistry",
            questionCount: 40,
            durationMinutes: 45,
            difficulty: "Hard",
            topics: ["Organic", "Physical"],
        },
    ],
};
