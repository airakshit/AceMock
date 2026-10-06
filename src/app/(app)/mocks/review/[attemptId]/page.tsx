import { Metadata } from "next";
import { notFound } from "next/navigation";
import { mockTestsService } from "@/features/mocks/service";
import { MockAttemptReviewClient } from "@/features/mocks/components/attempt/MockAttemptReviewClient";

export const metadata: Metadata = {
  title: "Review Attempt | ePeX",
  description: "Review your mock test attempt with detailed answer breakdown.",
};

interface ReviewPageProps {
  params: Promise<{ attemptId: string }>;
}

export default async function AttemptReviewPage({
  params,
}: ReviewPageProps) {
  const { attemptId } = await params;

  // Verify the attempt exists and is completed, get its mock test ID
  try {
    const attempt = await mockTestsService.getAttemptForReview(attemptId);
    if (!attempt) notFound();
  } catch {
    notFound();
  }

  return <MockAttemptReviewClient attemptId={attemptId} />;
}