// Client action input commands for mock tests mutations
// Accessed by: client components, server actions, and services

export interface CreateMockTestFromDocumentsPayload {
  name: string;
  documentIds: string[];
  durationMinutes: number;
  negativePercentagePerQuestion: number;
  instructions?: string;
  customTotalMarks?: number;
}
