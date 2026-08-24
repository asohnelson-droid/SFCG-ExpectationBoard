import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, ensureAnonymousSession } from '../lib/supabase';
import { Tooltip } from '../components/Tooltip';
import { BackButton } from '../components/BackButton';
import { Send, Info, CheckCircle2, MessageSquare, Sparkles, HelpCircle, ClipboardList, ChevronRight, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LanguageToggle } from '../components/LanguageToggle';

import { Header } from '../components/Header';

export const ParticipantSubmission: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [event, setEvent] = useState<any>(null);
  const [expectation, setExpectation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [liveTests, setLiveTests] = useState<any[]>([]);
  const [testSubmissions, setTestSubmissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const init = async () => {
      if (!slug) return;

      try {
        const authUser = await ensureAnonymousSession();

        const { data: eventData, error: eventErr } = await supabase
          .from('events')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (eventErr || !eventData) {
          setError(t('submission.eventNotFound'));
          setLoading(false);
          return;
        }

        if (eventData.status === 'closed') {
          setError(t('submission.eventClosed'));
        } else {
          setEvent({ id: eventData.id, ...eventData, eventCode: eventData.event_code });

          const { data: tests } = await supabase
            .from('tests')
            .select('*')
            .eq('event_id', eventData.id)
            .eq('status', 'live');
          setLiveTests(tests || []);

          if (authUser && tests && tests.length > 0) {
            const subMap: Record<string, boolean> = {};
            await Promise.all(tests.map(async (test) => {
              const { data: existing } = await supabase
                .from('test_submissions')
                .select('id')
                .eq('test_id', test.id)
                .eq('access_token', authUser.id)
                .maybeSingle();
              if (existing) subMap[test.id] = true;
            }));
            setTestSubmissions(subMap);
          }
        }
      } catch (err) {
        console.error('Init error:', err);
        setError(t('submission.errorOccurred'));
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [slug, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expectation.trim() || !event) return;

    setIsSubmitting(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertErr } = await supabase.from('submissions').insert({
        event_id: event.id,
        expectation: expectation.trim(),
        participant_id: user?.id ?? null,
      });

      if (insertErr) throw insertErr;
      setSubmitted(true);
    } catch (err) {
      console.error('Submit error:', err);
      setError(t('submission.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="absolute top-6 right-6">
        <LanguageToggle />
      </div>
      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
        <Info className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-brand-navy">{t('submission.oops')}</h1>
      <p className="text-zinc-500 max-w-xs">{error}</p>
      <button
        onClick={() => navigate('/')}
        className="px-6 py-2 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors shadow-sm"
      >
        {t('submission.goHome')}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Header showNavigation={false} />

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Background Decorative Gradient */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl opacity-50" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-brand-navy/5 rounded-full blur-3xl opacity-50" />
        </div>

        <div className="max-w-lg w-full space-y-8 relative z-10">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-brand-navy">{event.title}</h1>
            <p className="text-zinc-500">{t('submission.shareExpectations')}</p>
          </div>

          {liveTests.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-brand-navy px-1">
                <ClipboardList size={20} className="text-primary" />
                <h2 className="font-bold text-lg">{t('submission.activeAssessments')}</h2>
              </div>
              <div className="grid gap-3">
                {liveTests.map(test => {
                  const isCompleted = testSubmissions[test.id];
                  return (
                    <button
                      key={test.id}
                      type="button"
                      onClick={() => navigate(`/test/${test.id}`)}
                      className={`flex items-center justify-between p-4 bg-white border rounded-2xl transition-all group hover:shadow-md ${
                        isCompleted ? 'border-emerald-200 bg-emerald-50/30' : 'border-zinc-200 hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-4 text-left">
                        <div className={`p-3 rounded-xl ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${isCompleted ? 'text-emerald-600' : 'text-indigo-600'}`}>
                            {t(`test.types.${test.type}`)}
                          </p>
                          <h3 className="text-base font-bold text-zinc-900">{test.title}</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isCompleted ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                            <CheckCircle2 size={14} />
                            {t('test.statuses.completed') || 'Completed'}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-primary group-hover:translate-x-1 transition-transform">
                            <span className="text-xs font-bold">{t('test.actions.start') || 'Start'}</span>
                            <ChevronRight size={18} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-xl space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {t('submission.yourExpectation')}
                      <Tooltip text={t('submission.expectationTooltip')}>
                        <Info className="w-4 h-4 text-zinc-400 cursor-help" />
                      </Tooltip>
                    </div>
                    <span className="text-xs text-zinc-400 font-normal">{expectation.length}/500</span>
                  </label>
                  <textarea
                    required
                    maxLength={500}
                    value={expectation}
                    onChange={(e) => setExpectation(e.target.value)}
                    placeholder={t('submission.placeholder')}
                    rows={6}
                    className="w-full px-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none text-lg"
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <div className="p-2 bg-emerald-500 text-white rounded-lg">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-emerald-700 font-medium">{t('submission.anonymousNote')}</p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !expectation.trim()}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      {t('submission.submitButton')}
                    </>
                  )}
                </button>

                <div className="flex justify-center">
                  <Tooltip text={t('submission.helpTooltip')}>
                    <button type="button" className="text-zinc-400 hover:text-zinc-600 flex items-center gap-1 text-xs transition-colors">
                      <HelpCircle className="w-3 h-3" />
                      {t('submission.help')}
                    </button>
                  </Tooltip>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-12 rounded-3xl border border-zinc-200 shadow-xl text-center space-y-6"
            >
            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-brand-navy">{t('submission.thankYou')}</h2>
              <p className="text-zinc-500">{t('submission.successMessage')}</p>
            </div>
            <button
              onClick={() => setSubmitted(false)}
              className="w-full py-3 bg-zinc-100 text-brand-navy rounded-xl font-semibold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-5 h-5" />
              {t('submission.submitAnother')}
            </button>
            <p className="text-xs text-zinc-400">{t('submission.footerNote')}</p>
          </motion.div>
          )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};
