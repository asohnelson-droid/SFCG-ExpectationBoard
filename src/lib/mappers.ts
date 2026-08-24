// Postgres/Supabase returns snake_case columns; the UI (ported from the
// Firestore version) expects the same camelCase shapes as before. These
// mappers keep that translation in one place instead of touching every page.

export function mapEvent(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventCode: row.event_code,
    slug: row.slug,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function mapSubmission(row: any) {
  return {
    id: row.id,
    eventId: row.event_id,
    expectation: row.expectation,
    category: row.category,
    participantId: row.participant_id,
    createdAt: row.created_at,
  };
}

export function mapTest(row: any) {
  return {
    id: row.id,
    eventId: row.event_id,
    type: row.type,
    title: row.title,
    instructions: row.instructions,
    status: row.status,
    scoringMode: row.scoring_mode,
    passMark: row.pass_mark,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTestQuestion(row: any) {
  return {
    id: row.id,
    testId: row.test_id,
    type: row.type,
    text: row.text,
    helpText: row.help_text,
    isRequired: row.is_required,
    weight: row.weight,
    orderIndex: row.order_index,
    options: row.options,
    correctAnswer: row.correct_answer,
    acceptableAnswers: row.acceptable_answers,
    rubric: row.rubric,
  };
}

export function mapTestSubmission(row: any) {
  return {
    id: row.id,
    testId: row.test_id,
    participantName: row.participant_name,
    organization: row.organization,
    role: row.role,
    accessToken: row.access_token,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    status: row.status,
    totalScore: row.total_score,
    aiScoreStatus: row.ai_score_status,
    requiresManualReview: row.requires_manual_review,
  };
}

export function mapTestSubmissionAnswer(row: any) {
  return {
    id: row.id,
    submissionId: row.submission_id,
    questionId: row.question_id,
    answerText: row.answer_text,
    selectedOptions: row.selected_options,
    awardedScore: row.awarded_score,
    aiFeedback: row.ai_feedback,
    confidenceScore: row.confidence_score,
    finalReviewedScore: row.final_reviewed_score,
    finalReviewStatus: row.final_review_status,
  };
}
