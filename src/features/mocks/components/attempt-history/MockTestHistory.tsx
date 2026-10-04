"use client";

import {
  MockTestAttemptsTable,
  type AttemptGroup,
} from "./MockTestAttemptsTable";

export type { AttemptGroup };

interface MockTestHistoryProps {
  groups: AttemptGroup[];
  /** Open the per-question breakdown of a completed attempt. */
  onOpenDetails: (attemptId: string) => void;
  /** Continue an attempt that is still in progress. */
  onResume: (mockTestId: string) => void;
}

/**
 * Container for the attempt history: renders one fully independent
 * MockTestAttemptsTable card per mock test (test name as the card header),
 * visually separated with a vertical gap.
 */
export function MockTestHistory({
  groups,
  onOpenDetails,
  onResume,
}: MockTestHistoryProps) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <MockTestAttemptsTable
          key={group.mockTestId}
          group={group}
          onOpenDetails={onOpenDetails}
          onResume={onResume}
        />
      ))}
    </div>
  );
}
