export type TestType = 'pre_test' | 'post_test';
export type TestStatus = 'draft' | 'live' | 'closed';
export type ScoringMode = 'auto' | 'ai' | 'hybrid';
export type QuestionType = 'multiple_choice' | 'multiple_select' | 'short_answer' | 'paragraph' | 'true_false';
export type SubmissionStatus = 'started' | 'submitted';
export type AIScoreStatus = 'pending' | 'completed' | 'failed';
export type ReviewStatus = 'pending' | 'approved';

// Timestamps are ISO 8601 strings (Postgres `timestamptz`, returned as text
// over the Supabase client) rather than Firestore Timestamp objects.

export interface Test {
  id: string;
  eventId: string;
  type: TestType;
  title: string;
  instructions: string;
  status: TestStatus;
  scoringMode: ScoringMode;
  passMark?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestQuestion {
  id: string;
  testId: string;
  type: QuestionType;
  text: string;
  helpText?: string;
  isRequired: boolean;
  weight: number;
  orderIndex: number;
  correctAnswer?: any;
  acceptableAnswers?: string[];
  rubric?: string;
  options?: string[]; // For multiple choice/select
}

export interface TestSubmission {
  id: string;
  testId: string;
  participantName: string;
  organization?: string;
  role?: string;
  accessToken: string;
  startedAt: string;
  submittedAt?: string;
  status: SubmissionStatus;
  totalScore?: number;
  aiScoreStatus?: AIScoreStatus;
  requiresManualReview?: boolean;
}

export interface TestSubmissionAnswer {
  id: string;
  submissionId: string;
  questionId: string;
  answerText?: string;
  selectedOptions?: string[];
  awardedScore?: number;
  aiFeedback?: string;
  confidenceScore?: number;
  finalReviewedScore?: number;
  finalReviewStatus?: ReviewStatus;
}
