// Service return models
// Accessed by: services, server actions, and frontend callers

import { MockTestDetailsProjection, MockTestListItemProjection } from "./projections";

export interface CreateMockTestResult {
  id: string;
  name: string;
  totalMarks: number;
  totalQuestions: number;
  durationSeconds: number;
  negativePercentagePerQuestion: number;
}

export type MockTestDetailsResult = MockTestDetailsProjection;

export type MockTestListResult = MockTestListItemProjection[];

export interface DeleteMockTestResult {
  deletedId: string;
  success: boolean;
}
