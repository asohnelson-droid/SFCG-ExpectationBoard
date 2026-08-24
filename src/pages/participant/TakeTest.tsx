import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, ensureAnonymousSession } from '../../lib/supabase';
import { mapTestQuestion } from '../../lib/mappers';
import { Test, TestQuestion } from '../../types/test';
import { ChevronRight, ChevronLeft, Send, CheckCircle, AlertCircle, Clock, User, Building2, Briefcase, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const TakeTest: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<Test | null>(null);
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'identity' | 'questions' | 'completed'>('identity');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [participantInfo, setParticipantInfo] = useState({
    name: '',
    organization: '',
    role: ''
  });

  const [answers, setAnswers] = useState<Record<string, { text?: string; options?: string[] }>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadTest = async () => {
      if (!testId) return;

      try {
        await ensureAnonymousSession();

        // Note: this reads the safe `test_questions_public` view (no
        // correct_answer / rubric) — see supabase/migrations/0001_init.sql.
        const { data: testData, error: testErr } = await supabase
          .from('tests')
          .select('*')
          .eq('id', testId)
          .maybeSingle();

        if (testErr || !testData) {
          alert("Test not found.");
          navigate('/');
          return;
        }

        if (testData.status !== 'live') {
          alert("This test is not currently active.");
          navigate('/');
          return;
        }
        setTest({
          id: testData.id,
          eventId: testData.event_id,
          type: testData.type,
          title: testData.title,
          instructions: testData.instructions,
          status: testData.status,
          scoringMode: testData.scoring_mode,
          passMark: testData.pass_mark,
          createdBy: testData.created_by,
          createdAt: testData.created_at,
          updatedAt: testData.updated_at,
        });

        if (testData.event_id) {
          const { data: eventData } = await supabase
            .from('events')
            .select('slug')
            .eq('id', testData.event_id)
            .maybeSingle();
          if (eventData) setEventSlug(eventData.slug);
        }

        const { data: questionRows, error: qErr } = await supabase
          .from('test_questions_public')
          .select('*')
          .eq('test_id', testId);

        if (qErr) throw qErr;
        const questionData = (questionRows || []).map(mapTestQuestion);
        setQuestions(questionData.sort((a, b) => a.orderIndex - b.orderIndex));
      } catch (error) {
        console.error("Error loading test:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTest();
  }, [testId, navigate]);

  const handleStart = async () => {
    if (!participantInfo.name) {
      alert("Please enter your name.");
      return;
    }

    setStep('questions');
  };

  const handleAnswerChange = (questionId: string, value: { text?: string; options?: string[] }) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!test) return;

    setSubmitting(true);
    try {
      // Scoring happens entirely in the score-test Edge Function: the
      // browser never had (and never sends) the correct answers, only what
      // the participant picked/typed.
      const { error } = await supabase.functions.invoke('score-test', {
        body: {
          testId: test.id,
          participantName: participantInfo.name,
          organization: participantInfo.organization,
          role: participantInfo.role,
          answers: questions.map(q => ({
            questionId: q.id,
            text: answers[q.id]?.text,
            options: answers[q.id]?.options,
          })),
        },
      });

      if (error) throw error;

      setStep('completed');
    } catch (error) {
      console.error("Error submitting test:", error);
      alert("Failed to submit test. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Clock className="animate-spin text-indigo-600" /></div>;
  if (!test) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {step === 'identity' && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText size={32} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{test.title}</h1>
                <p className="text-gray-500 mt-2">{test.instructions}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={participantInfo.name}
                      onChange={(e) => setParticipantInfo({ ...participantInfo, name: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Organization / Community</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={participantInfo.organization}
                      onChange={(e) => setParticipantInfo({ ...participantInfo, organization: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="Where are you from?"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Role</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={participantInfo.role}
                      onChange={(e) => setParticipantInfo({ ...participantInfo, role: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="What is your role?"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleStart}
                className="w-full mt-8 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                <span>Start Assessment</span>
                <ChevronRight size={20} />
              </button>
            </motion.div>
          )}

          {step === 'questions' && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Progress */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-bold text-indigo-600">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </div>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-xs font-bold text-gray-400 uppercase">
                  {test.title}
                </div>
              </div>

              {/* Question Card */}
              <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 min-h-[400px] flex flex-col">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {questions[currentQuestionIndex].text}
                    {questions[currentQuestionIndex].isRequired && <span className="text-red-500 ml-1">*</span>}
                  </h2>
                  {questions[currentQuestionIndex].helpText && (
                    <p className="text-gray-500 text-sm mb-6">{questions[currentQuestionIndex].helpText}</p>
                  )}

                  <div className="mt-8 space-y-3">
                    {/* Multiple Choice / True False */}
                    {(questions[currentQuestionIndex].type === 'multiple_choice' || questions[currentQuestionIndex].type === 'true_false') && (
                      <div className="space-y-3">
                        {(questions[currentQuestionIndex].type === 'true_false' ? ['True', 'False'] : questions[currentQuestionIndex].options || []).map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => handleAnswerChange(questions[currentQuestionIndex].id, { options: [opt] })}
                            className={`w-full p-4 text-left rounded-xl border-2 transition-all flex items-center justify-between ${
                              answers[questions[currentQuestionIndex].id]?.options?.[0] === opt
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                : 'border-gray-100 hover:border-gray-200 text-gray-700'
                            }`}
                          >
                            <span className="font-medium">{opt}</span>
                            {answers[questions[currentQuestionIndex].id]?.options?.[0] === opt && <CheckCircle size={20} />}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Multiple Select */}
                    {questions[currentQuestionIndex].type === 'multiple_select' && (
                      <div className="space-y-3">
                        {(questions[currentQuestionIndex].options || []).map((opt, i) => {
                          const isSelected = answers[questions[currentQuestionIndex].id]?.options?.includes(opt);
                          return (
                            <button
                              key={i}
                              onClick={() => {
                                const current = Array.isArray(answers[questions[currentQuestionIndex].id]?.options)
                                  ? (answers[questions[currentQuestionIndex].id]?.options as string[])
                                  : [];
                                const next = isSelected ? current.filter(o => o !== opt) : [...current, opt];
                                handleAnswerChange(questions[currentQuestionIndex].id, { options: next });
                              }}
                              className={`w-full p-4 text-left rounded-xl border-2 transition-all flex items-center justify-between ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                  : 'border-gray-100 hover:border-gray-200 text-gray-700'
                              }`}
                            >
                              <span className="font-medium">{opt}</span>
                              {isSelected && <CheckCircle size={20} />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Short Answer / Paragraph */}
                    {(questions[currentQuestionIndex].type === 'short_answer' || questions[currentQuestionIndex].type === 'paragraph') && (
                      <textarea
                        value={answers[questions[currentQuestionIndex].id]?.text || ''}
                        onChange={(e) => handleAnswerChange(questions[currentQuestionIndex].id, { text: e.target.value })}
                        className="w-full p-4 border-2 border-gray-100 rounded-xl focus:border-indigo-500 outline-none transition-all min-h-[150px] resize-none"
                        placeholder="Type your answer here..."
                      />
                    )}
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center mt-12 pt-8 border-t border-gray-100">
                  <button
                    onClick={handlePrev}
                    disabled={currentQuestionIndex === 0}
                    className="flex items-center gap-2 text-gray-500 font-bold hover:text-gray-700 disabled:opacity-30"
                  >
                    <ChevronLeft size={20} />
                    <span>Previous</span>
                  </button>

                  {currentQuestionIndex === questions.length - 1 ? (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Clock className="animate-spin" size={20} />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Send size={20} />
                          <span>Submit Test</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleNext}
                      className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
                    >
                      <span>Next</span>
                      <ChevronRight size={20} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === 'completed' && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-12 rounded-2xl shadow-xl border border-gray-100 text-center"
            >
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={48} />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Assessment Submitted!</h1>
              <p className="text-gray-500 mb-8">Thank you for completing the {test.title}. Your responses have been recorded successfully.</p>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 text-left mb-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Submission Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Participant:</span>
                    <span className="font-bold text-gray-900">{participantInfo.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Time:</span>
                    <span className="font-bold text-gray-900">{new Date().toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => eventSlug ? navigate(`/event/${eventSlug}/submit`) : navigate('/')}
                className="text-indigo-600 font-bold hover:underline"
              >
                Return to Event Home
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
