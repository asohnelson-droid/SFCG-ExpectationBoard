import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { mapTest, mapTestQuestion, mapTestSubmission, mapTestSubmissionAnswer } from '../../lib/mappers';
import { Test, TestQuestion, TestSubmission, TestSubmissionAnswer } from '../../types/test';
import { ChevronLeft, CheckCircle, Star, MessageSquare, RefreshCw, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { scoreOpenEndedAnswer } from '../../services/aiScoringService';
import { useTranslation } from 'react-i18next';

export const TestReview: React.FC = () => {
  const { t } = useTranslation();
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<TestSubmission | null>(null);
  const [answers, setAnswers] = useState<TestSubmissionAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [scoring, setScoring] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadData = async () => {
      if (!testId) return;

      try {
        const { data: testRow, error: testErr } = await supabase.from('tests').select('*').eq('id', testId).maybeSingle();
        if (testErr || !testRow) {
          alert(t('testReview.notFound'));
          navigate('/admin');
          return;
        }
        setTest(mapTest(testRow));

        const { data: questionRows } = await supabase.from('test_questions').select('*').eq('test_id', testId);
        setQuestions((questionRows || []).map(mapTestQuestion).sort((a, b) => a.orderIndex - b.orderIndex));

        const { data: submissionRows } = await supabase
          .from('test_submissions')
          .select('*')
          .eq('test_id', testId)
          .order('submitted_at', { ascending: false });
        setSubmissions((submissionRows || []).map(mapTestSubmission));
      } catch (error) {
        console.error("Error loading review data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [testId, navigate]);

  const handleSelectSubmission = async (submission: TestSubmission) => {
    setSelectedSubmission(submission);
    setReviewing(true);

    const { data: answerRows } = await supabase
      .from('test_submission_answers')
      .select('*')
      .eq('submission_id', submission.id);
    setAnswers((answerRows || []).map(mapTestSubmissionAnswer));
  };

  const handleAIScore = async (answerId: string) => {
    setScoring(prev => ({ ...prev, [answerId]: true }));
    try {
      const result = await scoreOpenEndedAnswer(answerId);

      setAnswers(prev => prev.map(a => a.id === answerId ? {
        ...a,
        awardedScore: result.score,
        aiFeedback: result.feedback,
        confidenceScore: result.confidence,
        finalReviewedScore: result.score,
      } : a));
    } catch (error) {
      console.error("AI Scoring Error:", error);
    } finally {
      setScoring(prev => ({ ...prev, [answerId]: false }));
    }
  };

  const handleUpdateScore = async (answerId: string, score: number) => {
    const { error } = await supabase
      .from('test_submission_answers')
      .update({ final_reviewed_score: score, final_review_status: 'approved' })
      .eq('id', answerId);
    if (error) {
      console.error('Update score error:', error);
      return;
    }

    setAnswers(prev => prev.map(a => a.id === answerId ? {
      ...a,
      finalReviewedScore: score,
      finalReviewStatus: 'approved'
    } : a));
  };

  const handleFinalizeSubmission = async () => {
    if (!selectedSubmission) return;

    const totalScore = answers.reduce((sum, a) => sum + (a.finalReviewedScore || a.awardedScore || 0), 0);

    const { error } = await supabase
      .from('test_submissions')
      .update({ total_score: totalScore, requires_manual_review: false, ai_score_status: 'completed' })
      .eq('id', selectedSubmission.id);

    if (error) {
      console.error('Finalize submission error:', error);
      return;
    }

    setSubmissions(prev => prev.map(s => s.id === selectedSubmission.id ? {
      ...s,
      totalScore,
      requiresManualReview: false,
      aiScoreStatus: 'completed'
    } : s));

    setReviewing(false);
    setSelectedSubmission(null);
  };

  if (loading) return <div className="p-8 text-center">{t('testReview.loading')}</div>;
  if (!test) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('testReview.title')}</h1>
            <p className="text-gray-500">{test.title} • {t('testReview.submissionsCount', { count: submissions.length })}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submissions List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-400 uppercase">{t('testReview.participants')}</h3>
              </div>
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {submissions.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => handleSelectSubmission(sub)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between ${
                      selectedSubmission?.id === sub.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    <div>
                      <div className="font-bold text-gray-900">{sub.participantName}</div>
                      <div className="text-xs text-gray-500">{sub.organization || t('testReview.noOrganization')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-indigo-600">{sub.totalScore || 0} pts</div>
                      {sub.requiresManualReview && (
                        <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-bold uppercase">{t('testReview.reviewBadge')}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Review Area */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {reviewing && selectedSubmission ? (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedSubmission.participantName}</h2>
                      <p className="text-sm text-gray-500">{selectedSubmission.organization} • {selectedSubmission.role}</p>
                    </div>
                    <button
                      onClick={handleFinalizeSubmission}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-all flex items-center gap-2"
                    >
                      <CheckCircle size={18} />
                      <span>{t('testReview.finalizeButton')}</span>
                    </button>
                  </div>

                  {questions.map((q) => {
                    const answer = answers.find(a => a.questionId === q.id);
                    return (
                      <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-gray-400 uppercase mb-1">{t('testReview.questionNumber', { number: q.orderIndex + 1 })}</h4>
                            <p className="text-lg font-bold text-gray-900">{q.text}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-gray-400 uppercase">{t('testReview.weight')}</div>
                            <div className="text-lg font-bold text-gray-900">{q.weight} pts</div>
                          </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                          <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">{t('testReview.participantsAnswer')}</h5>
                          <p className="text-gray-900">
                            {answer?.answerText || answer?.selectedOptions?.join(', ') || <span className="text-gray-400 italic">{t('testReview.noAnswer')}</span>}
                          </p>
                        </div>

                        {/* Scoring Controls */}
                        <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-4 items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-bold text-gray-600">{t('testReview.scoreLabel')}</label>
                              <input
                                type="number"
                                value={answer?.finalReviewedScore ?? answer?.awardedScore ?? 0}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleUpdateScore(answer!.id, isNaN(val) ? 0 : val);
                                }}
                                className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-lg font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
                                min="0"
                                max={q.weight}
                                step="0.5"
                              />
                              <span className="text-gray-400">/ {q.weight}</span>
                            </div>

                            {['short_answer', 'paragraph'].includes(q.type) && (
                              <button
                                onClick={() => handleAIScore(answer!.id)}
                                disabled={scoring[answer!.id]}
                                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100"
                              >
                                {scoring[answer!.id] ? <RefreshCw className="animate-spin" size={14} /> : <Star size={14} />}
                                <span>{t('testReview.aiScoreButton')}</span>
                              </button>
                            )}
                          </div>

                          {answer?.aiFeedback && (
                            <div className="w-full mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex gap-3">
                              <MessageSquare className="text-indigo-400 shrink-0" size={20} />
                              <div>
                                <div className="text-xs font-bold text-indigo-400 uppercase mb-1">{t('testReview.aiFeedback', { confidence: Math.round((answer.confidenceScore || 0) * 100) })}</div>
                                <p className="text-sm text-indigo-900 italic">"{answer.aiFeedback}"</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              ) : (
                <div className="h-[600px] bg-white rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-12">
                  <User className="text-gray-300 mb-4" size={64} />
                  <h2 className="text-xl font-bold text-gray-900">{t('testReview.selectParticipant')}</h2>
                  <p className="text-gray-500 max-w-xs">{t('testReview.selectParticipantSubtitle')}</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
