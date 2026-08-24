import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { mapEvent, mapSubmission } from '../lib/mappers';
import { Tooltip } from '../components/Tooltip';
import { BackButton } from '../components/BackButton';
import {
  Maximize2, Minimize2, Settings, Download, RefreshCw,
  MoreVertical, Share2, MessageSquare, Sparkles, Info, Users, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

export const LiveDisplay: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [event, setEvent] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;

    let submissionsChannel: ReturnType<typeof supabase.channel> | null = null;

    const loadSubmissions = async (eventId: string) => {
      const { data, error: subErr } = await supabase
        .from('submissions')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (subErr) {
        console.error('Error loading submissions:', subErr);
      } else {
        setSubmissions((data || []).map(mapSubmission));
      }
      setLoading(false);
    };

    const loadEvent = async () => {
      const { data, error: eventErr } = await supabase.from('events').select('*').eq('slug', slug).maybeSingle();
      if (eventErr || !data) {
        setError(t('submission.eventNotFound'));
        setLoading(false);
        return;
      }
      const mapped = mapEvent(data);
      setEvent(mapped);
      await loadSubmissions(mapped.id);

      submissionsChannel = supabase
        .channel(`live-display-${mapped.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'submissions', filter: `event_id=eq.${mapped.id}` },
          () => loadSubmissions(mapped.id)
        )
        .subscribe();
    };

    loadEvent();

    return () => {
      if (submissionsChannel) supabase.removeChannel(submissionsChannel);
    };
  }, [slug]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const submissionColors = [
    { bg: 'bg-brand-navy/10', border: 'border-brand-navy/20', text: 'text-white', meta: 'text-zinc-400', accent: 'bg-brand-blue' },
    { bg: 'bg-brand-blue/10', border: 'border-brand-blue/20', text: 'text-white', meta: 'text-zinc-400', accent: 'bg-brand-cyan' },
    { bg: 'bg-brand-cyan/10', border: 'border-brand-cyan/20', text: 'text-white', meta: 'text-zinc-400', accent: 'bg-brand-blue' },
    { bg: 'bg-zinc-800/50', border: 'border-zinc-700', text: 'text-white', meta: 'text-zinc-400', accent: 'bg-brand-navy' },
  ];

  if (loading) return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-6 text-center space-y-4">
      <h1 className="text-2xl font-bold text-white">Oops!</h1>
      <p className="text-zinc-400 max-w-xs">{error}</p>
      <button
        onClick={() => navigate('/')}
        className="px-6 py-2 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors shadow-sm"
      >
        Go Home
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/10 bg-zinc-900/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-6">
          <BackButton
            fallbackPath={`/event/${event.slug}`}
            tooltip={t('liveDisplay.exit')}
            className="text-zinc-400 hover:bg-white/10"
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">{event.title}</h1>
            <div className="flex items-center gap-4 text-xs text-zinc-400 uppercase tracking-widest font-bold">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {t('liveDisplay.joinCode')} <span className="text-brand-cyan font-mono">{event.eventCode}</span>
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {t('liveDisplay.submissionsCount', { count: submissions.length })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Tooltip text={t('liveDisplay.share')}>
            <button className="p-2 hover:bg-white/10 rounded-xl transition-colors text-zinc-400">
              <Share2 className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip text={t('liveDisplay.download')}>
            <button className="p-2 hover:bg-white/10 rounded-xl transition-colors text-zinc-400">
              <Download className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip text={isFullscreen ? t('liveDisplay.exitFullscreen') : t('liveDisplay.enterFullscreen')}>
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-zinc-400"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </Tooltip>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <Tooltip text={t('liveDisplay.settings')}>
            <button className="p-2 hover:bg-white/10 rounded-xl transition-colors text-zinc-400">
              <Settings className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip text={t('liveDisplay.more')}>
            <button className="p-2 hover:bg-white/10 rounded-xl transition-colors text-zinc-400">
              <MoreVertical className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          {submissions.length > 0 ? (
            <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
              <AnimatePresence mode="popLayout">
                {submissions.map((sub, index) => {
                  const color = submissionColors[index % submissionColors.length];
                  return (
                    <motion.div
                      key={sub.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.4 }}
                      className={`break-inside-avoid ${color.bg} border ${color.border} p-8 rounded-3xl backdrop-blur-sm transition-all group relative overflow-hidden shadow-lg`}
                    >
                      <div className={`absolute top-0 left-0 w-1 h-full ${color.accent} opacity-50`} />
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className={`flex items-center gap-2 ${color.meta} text-[10px] font-bold uppercase tracking-widest`}>
                            <Sparkles className={`w-3 h-3 ${color.accent} opacity-50`} />
                            {t('liveDisplay.newSubmission')}
                          </div>
                          <span className={`text-[10px] ${color.meta} font-bold uppercase tracking-widest`}>
                            {sub.createdAt ? format(new Date(sub.createdAt), 'h:mm a') : t('liveDisplay.justNow')}
                          </span>
                        </div>
                        <p className={`text-2xl font-medium leading-relaxed ${color.text}`}>
                          {sub.expectation}
                        </p>
                        {sub.category && (
                          <div className={`inline-block px-3 py-1 ${color.accent} bg-opacity-10 rounded-full text-[10px] font-bold uppercase tracking-widest ${color.text} opacity-70`}>
                            {sub.category}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-48 space-y-8 text-center">
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-32 h-32 bg-brand-cyan/20 rounded-full blur-3xl absolute inset-0"
                />
                <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-full flex items-center justify-center relative">
                  <MessageSquare className="w-10 h-10 text-zinc-500" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-4xl font-bold tracking-tight">{t('liveDisplay.waiting')}</h2>
                <p className="text-xl text-zinc-500 max-w-md mx-auto">
                  {t('liveDisplay.joinAt')} <span className="text-white font-bold">ExpectationBoard.com</span> {t('liveDisplay.usingCode')} <span className="text-brand-cyan font-mono font-bold tracking-widest">{event.eventCode}</span>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Tooltip text={t('liveDisplay.refresh')}>
                  <button className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                    <RefreshCw className="w-6 h-6" />
                  </button>
                </Tooltip>
                <Tooltip text={t('liveDisplay.info')}>
                  <button className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                    <Info className="w-6 h-6" />
                  </button>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-4 bg-zinc-950/50 border-t border-white/10 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        <div className="flex items-center gap-4">
          <span>{t('liveDisplay.liveUpdates')}</span>
          <div className="w-1.5 h-1.5 bg-brand-cyan rounded-full animate-pulse" />
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(), 'MMMM d, yyyy')}
          </span>
          <span className="text-zinc-700">|</span>
          <span>ExpectationBoard v1.0</span>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
};
