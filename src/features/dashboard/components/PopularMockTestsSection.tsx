import Link from "next/link";

import {
    MockTestCard,
    type MockTestCardData,
} from "@/components/patterns/mock-test-card";
import { SectionHeader } from "@/components/patterns/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PopularMockTest } from "@/features/dashboard/types";

interface PopularMockTestsSectionProps {
    tests: PopularMockTest[];
}

function toCardData(test: PopularMockTest): MockTestCardData {
    return {
        id: test.id,
        title: test.title,
        durationMinutes: test.durationMinutes,
        totalQuestions: test.totalQuestions,
        subject: test.subject,
        difficulty: test.difficulty,
        isPopular: test.isPopular,
    };
}

export function PopularMockTestsSection({
    tests,
}: PopularMockTestsSectionProps) {
    return (
        <section className="space-y-4">
            <SectionHeader
                title="Popular mock tests"
                description="Hand-picked tests students attempt the most."
                action={
                    <Link
                        href="/mocks"
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                        View all
                    </Link>
                }
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {tests.map((test) => (
                    <MockTestCard key={test.id} test={toCardData(test)} />
                ))}
            </div>
        </section>
    );
}
