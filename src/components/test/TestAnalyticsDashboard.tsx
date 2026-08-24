import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { mapEvent, mapTest, mapTestQuestion, mapTestSubmission, mapTestSubmissionAnswer } from '../../lib/mappers';
import { Test, TestQuestion, TestSubmission, TestSubmissionAnswer } from '../../types/test';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, Cell
} from 'recharts';
import {
  BarChart3, Users, Target, CheckCircle,
  AlertCircle, Clock, TrendingUp, Filter, Calendar,
  ArrowUpRight, ArrowDownRight, Info, HelpCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';

interface TestAnalyticsDashboardProps {
  eventId?: string;
}

export const TestAnalyticsDashboard: React.FC<TestAnalyticsDashboardProps> = ({ eventId: propEventId }) => {
  const { eventId: paramEventId } = useParams<{ eventId: string }>();
  const eventId = propEventId || paramEventId;
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('all');
  const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<TestSubmissionAnswer[]>([]);
  const [event, setEvent] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);

        if (eventId) {
          const { data: eventRow } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
          if (eventRow) setEvent(mapEvent(eventRow));
          await loadTests(eventId);
        } else if (user) {
          const { data: eventRows } = await supabase.from('events').select('*').eq('created_by', user.id);
          setEvents((eventRows || []).map(mapEvent));
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading initial analytics data:", error);
        setLoading(false);
      }
    };

    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, user]);

  const loadTests = async (id: string) => {
    const { data: testRows } = await supabase.from('tests').select('*').eq('event_id', id);
    const testsData = (testRows || []).map(mapTest);
    setTests(testsData);

    if (testsData.length > 0) {
      setSelectedTestId('all');
      await loadAnalyticsData(testsData, 'all');
    } else {
      setSubmissions([]);
      setQuestions([]);
      setAnswers([]);
      setLoading(false);
    }
  };

  const handleEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEventId = e.target.value;
    if (newEventId) {
      const selectedEvent = events.find(ev => ev.id === newEventId);
      setEvent(selectedEvent);
      loadTests(newEventId);
    } else {
      setEvent(null);
      setTests([]);
      setSubmissions([]);
    }
  };

  const loadAnalyticsData = async (allTests: Test[], testId: string) => {
    try {
      setLoading(true);

      let relevantTests = allTests;
      if (testId !== 'all') {
        relevantTests = allTests.filter(t => t.id === testId);
      }

      const testIds = relevantTests.map(t => t.id);

      if (testIds.length === 0) {
        setSubmissions([]);
        setQuestions([]);
        setAnswers([]);
        setLoading(false);
        return;
      }

      const { data: submissionRows } = await supabase
        .from('test_submissions')
        .select('*')
        .in('test_id', testIds)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: true });
      const subsData = (submissionRows || []).map(mapTestSubmission);
      setSubmissions(subsData);

      if (testId !== 'all') {
        const { data: questionRows } = await supabase.from('test_questions').select('*').eq('test_id', testId);
        const questionsData = (questionRows || [])
          .map(mapTestQuestion)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        setQuestions(questionsData);

        const subIds = subsData.map(s => s.id);
        if (subIds.length > 0) {
          const { data: answerRows } = await supabase
            .from('test_submission_answers')
            .select('*')
            .in('submission_id', subIds);
          setAnswers((answerRows || []).map(mapTestSubmissionAnswer));
        } else {
          setAnswers([]);
        }
      } else {
        setQuestions([]);
        setAnswers([]);
      }
    } catch (error) {
      console.error("Error loading filtered analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTestId = e.target.value;
    setSelectedTestId(newTestId);
    loadAnalyticsData(tests, newTestId);
  };

  // Aggregations
  const totalSubmissions = submissions.length;
  const avgScore = totalSubmissions > 0
    ? submissions.reduce((sum, s) => sum + (s.totalScore || 0), 0) / totalSubmissions
    : 0;
  const maxScore = totalSubmissions > 0 ? Math.max(...submissions.map(s => s.totalScore || 0)) : 0;
  const minScore = totalSubmissions > 0 ? Math.min(...submissions.map(s => s.totalScore || 0)) : 0;

  // Pass rate (if single test with pass mark)
  const currentTest = tests.find(t => t.id === selectedTestId);
  const passMark = currentTest?.passMark || 0;
  const passedCount = submissions.filter(s => (s.totalScore || 0) >= passMark).length;
  const passRate = totalSubmissions > 0 ? (passedCount / totalSubmissions) * 100 : 0;

  // Trend data
  const trendData = submissions.reduce((acc: any[], sub) => {
    const date = sub.submittedAt ? format(new Date(sub.submittedAt), 'MMM d') : 'Unknown';
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.count += 1;
      existing.avgScore = (existing.avgScore * (existing.count - 1) + (sub.totalScore || 0)) / existing.count;
    } else {
      acc.push({ date, count: 1, avgScore: sub.totalScore || 0 });
    }
    return acc;
  }, []);

  // Question performance
  const questionStats = questions.map(q => {
    const qAnswers = answers.filter(a => a.questionId === q.id);
    const totalResponses = qAnswers.length;
    const avgQScore = totalResponses > 0
      ? qAnswers.reduce((sum, a) => sum + (a.finalReviewedScore ?? a.awardedScore ?? 0), 0) / totalResponses
      : 0;

    let correctRate = 0;
    if (q.type !== 'paragraph' && q.type !== 'short_answer') {
      const correctCount = qAnswers.filter(a => (a.finalReviewedScore ?? a.awardedScore ?? 0) === q.weight).length;
      correctRate = totalResponses > 0 ? (correctCount / totalResponses) * 100 : 0;
    } else {
      correctRate = q.weight > 0 ? (avgQScore / q.weight) * 100 : 0;
    }

    return {
      ...q,
      avgScore: avgQScore,
      correctRate,
      totalResponses
    };
  });

  // Pre vs Post Comparison
  const preTest = tests.find(t => t.type === 'pre_test');
  const postTest = tests.find(t => t.type === 'post_test');

  const preSubs = submissions.filter(s => s.testId === preTest?.id);
  const postSubs = submissions.filter(s => s.testId === postTest?.id);

  const preAvg = preSubs.length > 0 ? preSubs.reduce((sum, s) => sum + (s.totalScore || 0), 0) / preSubs.length : 0;
  const postAvg = postSubs.length > 0 ? postSubs.reduce((sum, s) => sum + (s.totalScore || 0), 0) / postSubs.length : 0;
  const improvement = postAvg - preAvg;

  if (loading && tests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-zinc-300">
        <div className="max-w-xs mx-auto space-y-4">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
            <BarChart3 className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="text-xl font-bold text-brand-navy">{t('analytics.noTests')}</h3>
          <p className="text-zinc-500">{t('analytics.createFirst')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Filter className="w-5 h-5 text-indigo-600" />
          </div>
          <h2 className="text-lg font-bold text-brand-navy">{t('analytics.filters')}</h2>
        </div>
        <div className="flex items-center gap-3">
          {!propEventId && events.length > 0 && (
            <select
              value={event?.id || ''}
              onChange={handleEventChange}
              className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">{t('analytics.selectEvent')}</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          )}
          <select
            value={selectedTestId}
            onChange={handleTestChange}
            disabled={!event}
            className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
          >
            <option value="all">{t('analytics.allTests')}</option>
            {tests.map(tst => (
              <option key={tst.id} value={tst.id}>{tst.title} ({tst.type === 'pre_test' ? 'Pre-test' : 'Post-test'})</option>
            ))}
          </select>
          <button
            onClick={() => event && loadAnalyticsData(tests, selectedTestId)}
            disabled={!event}
            className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-500 disabled:opacity-50"
          >
            <Clock className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!event ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-zinc-300">
          <div className="max-w-xs mx-auto space-y-4">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
              <Calendar className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-xl font-bold text-brand-navy">{t('analytics.selectEventPrompt')}</h3>
            <p className="text-zinc-500">{t('analytics.selectEventDescription')}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
              {selectedTestId === 'all' ? t('analytics.stats.totalTests') : t('analytics.stats.submissions')}
            </p>
            {selectedTestId === 'all' ? <BarChart3 className="w-4 h-4 text-indigo-500" /> : <Users className="w-4 h-4 text-indigo-500" />}
          </div>
          <p className="text-3xl font-bold text-brand-navy">
            {selectedTestId === 'all' ? tests.length : totalSubmissions}
          </p>
          <p className="text-xs text-zinc-400">
            {selectedTestId === 'all' ? t('analytics.stats.assessmentsInEvent') : t('analytics.stats.totalCompleted')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">{t('analytics.stats.avgScore')}</p>
            <Target className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-brand-navy">{avgScore.toFixed(1)}</p>
          <p className="text-xs text-zinc-400">{t('analytics.stats.meanPerformance')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">{t('analytics.stats.scoreRange')}</p>
            <TrendingUp className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-brand-navy">{minScore} - {maxScore}</p>
          <p className="text-xs text-zinc-400">{t('analytics.stats.lowestHighest')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">{t('analytics.stats.passRate')}</p>
            <CheckCircle className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-brand-navy">{passRate.toFixed(0)}%</p>
          <p className="text-xs text-zinc-400">
            {selectedTestId === 'all' ? t('analytics.stats.totalSubmissions', { count: totalSubmissions }) : t('analytics.stats.basedOnPassMark', { mark: passMark })}
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Submission Trend */}
        <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-brand-navy">{t('analytics.trend.title')}</h3>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <div className="w-3 h-3 bg-indigo-500 rounded-full" />
              <span>{t('analytics.trend.submissions')}</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pre vs Post Comparison */}
        {preTest && postTest && (
          <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-brand-navy">{t('analytics.comparison.title')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-50 p-4 rounded-xl space-y-1">
                <p className="text-xs font-bold text-zinc-400 uppercase">{t('analytics.comparison.preAvg')}</p>
                <p className="text-2xl font-bold text-brand-navy">{preAvg.toFixed(1)}</p>
              </div>
              <div className="bg-zinc-50 p-4 rounded-xl space-y-1">
                <p className="text-xs font-bold text-zinc-400 uppercase">{t('analytics.comparison.postAvg')}</p>
                <p className="text-2xl font-bold text-brand-navy">{postAvg.toFixed(1)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${improvement >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {improvement >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  </div>
                  <span className="text-sm font-medium text-zinc-600">{t('analytics.comparison.improvement')}</span>
                </div>
                <span className={`text-lg font-bold ${improvement >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {improvement >= 0 ? '+' : ''}{improvement.toFixed(1)} pts
                </span>
              </div>

              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Pre-Test', score: preAvg, fill: '#94a3b8' },
                    { name: 'Post-Test', score: postAvg, fill: '#6366f1' }
                  ]}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <RechartsTooltip cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                      { [0, 1].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#94a3b8' : '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Question Performance Table */}
      {selectedTestId !== 'all' && questions.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-xl font-bold text-brand-navy">{t('analytics.questions.title')}</h3>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <HelpCircle size={14} />
              <span>{t('analytics.questions.basedOn', { count: totalSubmissions })}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50">
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('analytics.questions.table.question')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('analytics.questions.table.type')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-center">{t('analytics.questions.table.avgScore')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-center">{t('analytics.questions.table.successRate')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('analytics.questions.table.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {questionStats.map((q, idx) => (
                  <tr key={q.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-brand-navy line-clamp-1">Q{idx + 1}: {q.text}</p>
                        <p className="text-xs text-zinc-400">Weight: {q.weight}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-zinc-100 text-zinc-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        {q.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-brand-navy">{q.avgScore.toFixed(1)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-24 h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              q.correctRate >= 70 ? 'bg-emerald-500' :
                              q.correctRate >= 40 ? 'bg-orange-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${q.correctRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-zinc-600 w-8">{q.correctRate.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {q.correctRate < 40 ? (
                        <div className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-1 rounded-lg w-fit">
                          <AlertCircle size={14} />
                          <span className="text-[10px] font-bold uppercase">{t('analytics.questions.status.difficult')}</span>
                        </div>
                      ) : q.correctRate >= 80 ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit">
                          <CheckCircle size={14} />
                          <span className="text-[10px] font-bold uppercase">{t('analytics.questions.status.mastered')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-zinc-400 bg-zinc-50 px-2 py-1 rounded-lg w-fit">
                          <Info size={14} />
                          <span className="text-[10px] font-bold uppercase">{t('analytics.questions.status.normal')}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State for Question Analytics */}
      {selectedTestId === 'all' && (
        <div className="bg-zinc-50 p-12 rounded-3xl border border-dashed border-zinc-300 text-center space-y-4">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
            <HelpCircle className="w-8 h-8 text-zinc-300" />
          </div>
          <div className="max-w-xs mx-auto">
            <h4 className="text-lg font-bold text-brand-navy">{t('analytics.questions.insights')}</h4>
            <p className="text-sm text-zinc-500">{t('analytics.questions.insightsDescription')}</p>
          </div>
        </div>
      )}
    </>
  )}
</div>
  );
};
