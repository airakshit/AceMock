import { MockTestCard } from "@/components/patterns/mock-test-card";
import { mocksMockData } from "@/features/mocks/mockData";

export function MocksView() {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {mocksMockData.tests.map((test) => (
                    <MockTestCard
                        key={test.id}
                        test={{
                            id: test.id,
                            title: test.title,
                            durationMinutes: test.durationMinutes,
                            totalQuestions: test.totalQuestions,
                            subject: test.subject,
                            difficulty: test.difficulty,
                        }}
                    />
                ))}
        </div>
    );
}
