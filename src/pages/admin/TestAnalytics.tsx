import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { mapTest, mapTestQuestion, mapTestSubmission } from '../../lib/mappers';
import { Test, TestQuestion, TestSubmission } from '../../types/test';
import { ChevronLeft, BarChart2, TrendingUp, Users, Target, CheckCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const TestAnalytics: React.FC = () => {
  const { t } = useTranslation();
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const [comparisonTest, setComparisonTest] = useState<Test | null>(null);
  const [comparisonSubmissions, setComparisonSubmissions] = useState<TestSubmission[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!testId) return;

      try {
        const { data: testRow, error: testErr } = await supabase.from('tests').select('*').eq('id', testId).maybeSingle();
        if (testErr || !testRow) {
          alert(t('testAnalytics.notFound'));
          navigate('/admin');
          return;
        }
        const currentTest = mapTest(testRow);
        setTest(currentTest);

        const { data: questionRows } = await supabase.from('test_questions').select('*').eq('test_id', testId);
        setQuestions((questionRows || []).map(mapTestQuestion).sort((a, b) => a.orderIndex - b.orderIndex));

        const { data: submissionRows } = await supabase
          .from('test_submissions')
          .select('*')
          .eq('test_id', testId)
          .eq('status', 'submitted');
        setSubmissions((submissionRows || []).map(mapTestSubmission));

        // Comparison test (pre-test if this is post-test, or vice versa)
        const { data: compRows } = await supabase
          .from('tests')
          .select('*')
          .eq('event_id', currentTest.eventId)
          .eq('type', currentTest.type === 'pre_test' ? 'post_test' : 'pre_test')
          .limit(1);

        if (compRows && compRows.length > 0) {
          const compTest = mapTest(compRows[0]);
          setComparisonTest(compTest);

          const { data: compSubRows } = await supabase
            .from('test_submissions')
            .select('*')
            .eq('test_id', compTest.id)
            .eq('status', 'submitted');
          setComparisonSubmissions((compSubRows || []).map(mapTestSubmission));
        }
      } catch (error) {
        console.error("Error loading analytics data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [testId, navigate]);

  const calculateStats = (subs: TestSubmission[]) => {
    if (subs.length === 0) return { avg: 0, max: 0, min: 0, passRate: 0 };

    const scores = subs.map(s => s.totalScore || 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const min = Math.min(...scores);

    const passMark = test?.passMark || 0;
    const passCount = subs.filter(s => (s.totalScore || 0) >= passMark).length;
    const passRate = (passCount / subs.length) * 100;

    return { avg, max, min, passRate };
  };

  const stats = calculateStats(submissions);
  const compStats = calculateStats(comparisonSubmissions);

  if (loading) return <div className="p-8 text-center">{t('testAnalytics.loading')}</div>;
  if (!test) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('testAnalytics.title')}</h1>
            <p className="text-gray-500">{test.title} • {t(`test.types.${test.type}`)}</p>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 text-indigo-600 mb-2">
              <Users size={20} />
              <span className="text-xs font-bold uppercase">{t('testAnalytics.stats.submissions')}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{submissions.length}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 text-green-600 mb-2">
              <Target size={20} />
              <span className="text-xs font-bold uppercase">{t('testAnalytics.stats.avgScore')}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.avg.toFixed(1)}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 text-orange-600 mb-2">
              <TrendingUp size={20} />
              <span className="text-xs font-bold uppercase">{t('testAnalytics.stats.highestScore')}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.max}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 text-blue-600 mb-2">
              <CheckCircle size={20} />
              <span className="text-xs font-bold uppercase">{t('testAnalytics.stats.passRate')}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.passRate.toFixed(0)}%</div>
          </div>
        </div>

        {/* Comparison Section */}
        {comparisonTest && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <BarChart2 className="text-indigo-600" size={24} />
              <h2 className="text-xl font-bold text-gray-900">{t('testAnalytics.comparison.title')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase mb-1">{t('testAnalytics.comparison.improvement')}</div>
                    <div className="text-4xl font-bold text-gray-900 flex items-center gap-2">
                      {Math.abs(stats.avg - compStats.avg).toFixed(1)}
                      {stats.avg >= compStats.avg ? (
                        <ArrowUpRight className="text-green-500" size={32} />
                      ) : (
                        <ArrowDownRight className="text-red-500" size={32} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-500">{t(`test.types.${comparisonTest.type}`)}</span>
                      <span className="text-gray-900">{compStats.avg.toFixed(1)}</span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-400"
                        style={{ width: `${(compStats.avg / Math.max(stats.avg, compStats.avg)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-500">{t(`test.types.${test.type}`)}</span>
                      <span className="text-gray-900">{stats.avg.toFixed(1)}</span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600"
                        style={{ width: `${(stats.avg / Math.max(stats.avg, compStats.avg)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">{t('testAnalytics.comparison.keyInsights')}</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1.5 shrink-0" />
                    <span>{t('testAnalytics.comparison.knowledgeRetention', { percentage: compStats.avg > 0 ? ((stats.avg - compStats.avg) / compStats.avg * 100).toFixed(1) : '0.0' })}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1.5 shrink-0" />
                    <span>{t('testAnalytics.comparison.completionRate', { type: t(`test.types.${test.type}`), count: submissions.length })}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1.5 shrink-0" />
                    <span>{t('testAnalytics.comparison.highestScoreAchieved', { type: t(`test.types.${test.type}`), score: stats.max })}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Question Performance */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t('testAnalytics.questions.title')}</h2>
          <div className="space-y-6">
            {questions.map((q, i) => (
              <div key={q.id} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-gray-700">Q{i + 1}: {q.text}</span>
                  <span className="text-gray-500 font-medium">{t('testAnalytics.questions.weight', { weight: q.weight })}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 opacity-50"
                    style={{ width: '75%' }} // Placeholder for actual question-level analytics
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
