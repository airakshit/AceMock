import { Metadata } from "next";
import { notFound } from "next/navigation";
import { mockTestsService } from "@/features/mocks/service";
import { MockAttemptClient } from "@/features/mocks/components/attempt/MockAttemptClient";
import { MockTestAttemptMeta } from "@/features/mocks/components/attempt/types";

export const metadata: Metadata = {
  title: "Take Mock Test | AceMock",
  description: "Attempt your mock test.",
};

interface MockAttemptPageProps {
  params: Promise<{ id: string }>;
}

export default async function MockAttemptPage({
  params,
}: MockAttemptPageProps) {
  const { id } = await params;

  let meta: MockTestAttemptMeta;
  try {
    const test = await mockTestsService.getMockTestById(id);
    if (!test) notFound();

    // Only pass the fields the exam UI is allowed to see.
    // Correct answers, hints and solutions never reach the client.
    meta = {
      id: test.id,
      name: test.name,
      totalMarks: test.totalMarks,
      totalQuestions: test.questionCount,
      durationSeconds: test.durationSeconds,
      negativePercentagePerQuestion: test.negativePercentagePerQuestion,
    };
  } catch {
    notFound();
  }

  return <MockAttemptClient mockTest={meta} />;
}
