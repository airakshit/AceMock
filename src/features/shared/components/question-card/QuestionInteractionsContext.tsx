"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";

interface QuestionInteractionState {
  isBookmarked: boolean;
  reportedTypes: string[];
}

interface QuestionInteractionsContextValue {
  getState: (questionId: string) => QuestionInteractionState;
  setBookmarked: (questionId: string, bookmarked: boolean) => void;
  addReported: (questionId: string, reportType: string) => void;
  hasReported: (questionId: string, reportType: string) => boolean;
}

/** Internal storage for question interaction states. */
const storage = new Map<string, QuestionInteractionState>();

const QuestionInteractionsContext = createContext<
  QuestionInteractionsContextValue | null
>(null);

/**
 * Provider for question bookmark/report state.
 * Wraps the app (or relevant section) to persist interaction state
 * per question across navigation.
 */
export function QuestionInteractionsProvider({
  children,
  initialStates = [],
}: {
  children: React.ReactNode;
  /** Array of {questionId, isBookmarked, reportedTypes} from server. */
  initialStates?: Array<{
    questionId: string;
    isBookmarked: boolean;
    reportedTypes: string[];
  }>;
}) {
  // Initialize storage from server-provided states
  useEffect(() => {
    for (const initial of initialStates) {
      if (!storage.has(initial.questionId)) {
        storage.set(initial.questionId, {
          isBookmarked: initial.isBookmarked,
          reportedTypes: [...initial.reportedTypes],
        });
      }
    }
  }, [initialStates]);

  const [, forceUpdate] = useState({});

  const getState = useCallback(
    (questionId: string): QuestionInteractionState => {
      const existing = storage.get(questionId);
      if (existing) return existing;
      // Default state
      return { isBookmarked: false, reportedTypes: [] };
    },
    [],
  );

  const setBookmarked = useCallback(
    (questionId: string, bookmarked: boolean) => {
      const current = storage.get(questionId) ?? {
        isBookmarked: false,
        reportedTypes: [],
      };
      storage.set(questionId, { ...current, isBookmarked: bookmarked });
      forceUpdate((prev) => ({ ...prev }));
    },
    [],
  );

  const addReported = useCallback(
    (questionId: string, reportType: string) => {
      const current = storage.get(questionId) ?? {
        isBookmarked: false,
        reportedTypes: [],
      };
      if (!current.reportedTypes.includes(reportType)) {
        storage.set(questionId, {
          ...current,
          reportedTypes: [...current.reportedTypes, reportType],
        });
        forceUpdate((prev) => ({ ...prev }));
      }
    },
    [],
  );

  const hasReported = useCallback(
    (questionId: string, reportType: string) => {
      const state = storage.get(questionId);
      return state?.reportedTypes.includes(reportType) ?? false;
    },
    [],
  );

  const value = useMemo(
    () => ({ getState, setBookmarked, addReported, hasReported }),
    [getState, setBookmarked, addReported, hasReported],
  );

  return (
    <QuestionInteractionsContext.Provider value={value}>
      {children}
    </QuestionInteractionsContext.Provider>
  );
}

/**
 * Hook to access question interaction state for a specific question.
 * Manages bookmark/report state per questionId with persistence across navigation.
 */
export function useQuestionInteractions(
  questionId: string,
  initialBookmarked = false,
) {
  const context = useContext(QuestionInteractionsContext);

  if (!context) {
    throw new Error(
      "useQuestionInteractions must be used within QuestionInteractionsProvider",
    );
  }

  const { setBookmarked: contextSetBookmarked } = context;

  // Initialize local state from persistent storage
  const [isBookmarked, setIsBookmarked] = useState(() => {
    const state = storage.get(questionId);
    if (state) return state.isBookmarked;
    // Initialize with initialBookmarked if not in storage
    if (!storage.has(questionId)) {
      storage.set(questionId, { isBookmarked: initialBookmarked, reportedTypes: [] });
    }
    return initialBookmarked;
  });

  const [reportedTypes, setReportedTypes] = useState(() => {
    const state = storage.get(questionId);
    return state?.reportedTypes ?? [];
  });

  const toggleBookmarked = useCallback(() => {
    const newValue = !isBookmarked;
    setIsBookmarked(newValue);
    contextSetBookmarked(questionId, newValue);
  }, [questionId, isBookmarked, contextSetBookmarked]);

  const setBookmarked = useCallback((value: boolean) => {
    setIsBookmarked(value);
    contextSetBookmarked(questionId, value);
  }, [questionId, contextSetBookmarked]);

  const addReport = useCallback(
    (reportType: string) => {
      if (!reportedTypes.includes(reportType)) {
        const newReportedTypes = [...reportedTypes, reportType];
        setReportedTypes(newReportedTypes);
        context.addReported(questionId, reportType);
      }
    },
    [questionId, reportedTypes, context],
  );

  const checkReported = useCallback(
    (reportType: string) => {
      return context.hasReported(questionId, reportType);
    },
    [questionId, context],
  );

  return {
    isBookmarked,
    setBookmarked,
    toggleBookmarked,
    reportedTypes,
    addReport,
    hasReported: checkReported,
  };
}

export type { QuestionInteractionState };