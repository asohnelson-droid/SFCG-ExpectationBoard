import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { mapEvent, mapSubmission } from '../lib/mappers';
import { Tooltip } from '../components/Tooltip';
import { BackButton } from '../components/BackButton';
import {
  Share2, Copy, Download, Settings, Filter, Search, MoreVertical,
  RefreshCw, Trash2, CheckCircle2, XCircle, MessageSquare, Calendar, Users,
  LayoutGrid, List, BarChart3, Info, ExternalLink, QrCode, ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { LanguageToggle } from '../components/LanguageToggle';
import { TestList } from '../components/test/TestList';
import { TestEditor } from '../components/test/TestEditor';
import { TestAnalyticsDashboard } from '../components/test/TestAnalyticsDashboard';

import { Header } from '../components/Header';

export const EventDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [event, setEvent] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'expectations' | 'tests' | 'analytics'>('expectations');
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [showTestEditor, setShowTestEditor] = useState(false);

  useEffect(() => {
    if (!slug || !user) return;

    let submissionsChannel: ReturnType<typeof supabase.channel> | null = null;

    const loadSubmissions = async (eventId: string) => {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error loading submissions:', error);
      } else {
        setSubmissions((data || []).map(mapSubmission));
      }
      setLoading(false);
    };

    const loadEvent = async () => {
      const { data, error } = await supabase.from('events').select('*').eq('slug', slug).maybeSingle();
      if (error || !data) {
        navigate('/dashboard');
        return;
      }
      const mapped = mapEvent(data);
      setEvent(mapped);
      await loadSubmissions(mapped.id);

      submissionsChannel = supabase
        .channel(`event-submissions-${mapped.id}`)
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
  }, [slug, user, navigate]);

  const handleCopyCode = () => {
    if (!event) return;
    navigator.clipboard.writeText(event.eventCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownload = () => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + "Expectation,Category,Date\n"
      + submissions.map(s => {
          const dateStr = s.createdAt ? format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm:ss') : 'Recently';
          return `"${s.expectation}","${s.category || ''}","${dateStr}"`;
        }).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${event.slug}-expectations.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditTest = (testId: string) => {
    setEditingTestId(testId || null);
    setShowTestEditor(true);
  };

  const handleDeleteTest = async (testId: string) => {
    if (window.confirm(t('eventDetail.deleteTestConfirm'))) {
      const { error } = await supabase.from('tests').delete().eq('id', testId);
      if (error) console.error('Delete test error:', error);
    }
  };

  const handleToggleTestStatus = async (testId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'live' ? 'closed' : 'live';
    const { error } = await supabase.from('tests').update({ status: newStatus }).eq('id', testId);
    if (error) console.error('Update test status error:', error);
  };

  const filteredSubmissions = submissions.filter(s =>
    s.expectation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Header />

      {/* Sub Header / Breadcrumbs */}
      <div className="bg-white border-b border-zinc-200 sticky top-16 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton fallbackPath="/dashboard" tooltip={t('eventDetail.back')} />
            <div className="space-y-0.5">
              <h1 className="text-xl font-bold text-brand-navy">{event.title}</h1>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className={`w-2 h-2 rounded-full ${event.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                {t(`dashboard.status.${event.status}`).toUpperCase()} • {t('eventDetail.code')} <span className="font-mono font-bold text-brand-navy">{event.eventCode}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip text={t('eventDetail.copyCode')}>
              <button
                onClick={handleCopyCode}
                className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-600 relative"
              >
                {copySuccess ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
              </button>
            </Tooltip>
            <Tooltip text={t('eventDetail.shareEvent')}>
              <button className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-600">
                <Share2 className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip text={t('eventDetail.downloadCSV')}>
              <button
                onClick={handleDownload}
                className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-600"
              >
                <Download className="w-5 h-5" />
              </button>
            </Tooltip>
            <div className="w-px h-6 bg-zinc-200 mx-1" />
            <Tooltip text={t('eventDetail.liveDisplayMode')}>
              <button
                onClick={() => navigate(`/event/${event.slug}/live`)}
                className="px-4 py-2 bg-primary text-white rounded-xl font-semibold flex items-center gap-2 hover:bg-primary-dark transition-colors shadow-sm"
              >
                <BarChart3 className="w-4 h-4" />
                {t('eventDetail.liveView')}
              </button>
            </Tooltip>
            <Tooltip text={t('eventDetail.eventSettings')}>
              <button className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-600">
                <Settings className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip text={t('eventDetail.moreActions')}>
              <button className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-600">
                <MoreVertical className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-500">{t('eventDetail.stats.submissions')}</p>
              <Users className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-3xl font-bold text-brand-navy">{submissions.length}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-500">{t('eventDetail.stats.status')}</p>
              <Info className="w-4 h-4 text-zinc-400" />
            </div>
            <p className={`text-xl font-bold ${event.status === 'active' ? 'text-emerald-600' : 'text-zinc-500'}`}>
              {t(`dashboard.status.${event.status}`)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-500">{t('eventDetail.stats.created')}</p>
              <Calendar className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-xl font-bold text-brand-navy">
              {event.createdAt ? format(new Date(event.createdAt), 'MMM d') : t('eventDetail.stats.recently')}
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-500">{t('eventDetail.stats.joinCode')}</p>
              <QrCode className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-xl font-mono font-bold text-brand-navy">{event.eventCode}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200">
          <button
            onClick={() => setActiveTab('expectations')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'expectations' ? 'border-primary text-primary' : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <MessageSquare size={18} />
            <span>{t('eventDetail.tabs.expectations')}</span>
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'tests' ? 'border-primary text-primary' : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <ClipboardList size={18} />
            <span>{t('eventDetail.tabs.tests')}</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'analytics' ? 'border-primary text-primary' : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <BarChart3 size={18} />
            <span>{t('eventDetail.tabs.analytics')}</span>
          </button>
        </div>

        {activeTab === 'expectations' ? (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
                {t('eventDetail.tabs.expectations')}
                <span className="text-zinc-400 text-sm font-normal">({filteredSubmissions.length})</span>
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder={t('eventDetail.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all w-64"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Tooltip text={t('eventDetail.filterTooltip')}>
                      <Filter className="w-3 h-3 text-zinc-400 cursor-pointer" />
                    </Tooltip>
                  </div>
                </div>
                <div className="flex items-center bg-white border border-zinc-200 rounded-xl p-1">
                  <Tooltip text={t('eventDetail.gridView')}>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-zinc-100 text-brand-navy' : 'text-zinc-400 hover:text-zinc-600'}`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </Tooltip>
                  <Tooltip text={t('eventDetail.listView')}>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-zinc-100 text-brand-navy' : 'text-zinc-400 hover:text-zinc-600'}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
                <Tooltip text={t('eventDetail.refreshData')}>
                  <button className="p-2 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors text-zinc-600">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </Tooltip>
              </div>
            </div>

            {filteredSubmissions.length > 0 ? (
              <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
                <AnimatePresence mode="popLayout">
                  {filteredSubmissions.map((sub) => (
                    <motion.div
                      key={sub.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group ${viewMode === 'list' ? 'flex items-center justify-between gap-4' : ''}`}
                    >
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center">
                              <MessageSquare className="w-4 h-4 text-zinc-400" />
                            </div>
                            <span className="text-xs font-medium text-zinc-400">
                              {sub.createdAt ? format(new Date(sub.createdAt), 'h:mm a') : t('eventDetail.justNow')}
                            </span>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Tooltip text={t('eventDetail.deleteSubmission')}>
                              <button className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </Tooltip>
                            <Tooltip text={t('eventDetail.moreOptions')}>
                              <button className="p-1.5 text-zinc-400 hover:bg-zinc-100 rounded-lg transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          </div>
                        </div>
                        <p className="text-brand-navy font-medium leading-relaxed">
                          {sub.expectation}
                        </p>
                        {sub.category && (
                          <span className="inline-block px-2 py-1 bg-zinc-100 text-zinc-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            {sub.category}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-zinc-300">
                <div className="max-w-xs mx-auto space-y-4">
                  <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
                    <MessageSquare className="w-8 h-8 text-zinc-400" />
                  </div>
                  <h3 className="text-xl font-bold text-brand-navy">{t('eventDetail.noExpectations')}</h3>
                  <p className="text-zinc-500">{t('eventDetail.shareCodePrefix')} <span className="font-mono font-bold text-brand-navy">{event.eventCode}</span> {t('eventDetail.shareCodeSuffix')}</p>
                  <div className="flex items-center justify-center gap-2">
                    <Tooltip text={t('eventDetail.copyCode')}>
                      <button
                        onClick={handleCopyCode}
                        className="px-4 py-2 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <Copy className="w-4 h-4" />
                        {t('eventDetail.copyCodeButton')}
                      </button>
                    </Tooltip>
                    <Tooltip text={t('eventDetail.openSubmissionPage')}>
                      <button
                        onClick={() => navigate(`/event/${event.slug}/submit`)}
                        className="p-2 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors"
                      >
                        <ExternalLink className="w-5 h-5 text-zinc-600" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'tests' ? (
          <TestList
            eventId={event.id}
            onEdit={handleEditTest}
            onDelete={handleDeleteTest}
            onToggleStatus={handleToggleTestStatus}
          />
        ) : (
          <TestAnalyticsDashboard eventId={event.id} />
        )}
      </main>

      {showTestEditor && (
        <TestEditor
          eventId={event.id}
          testId={editingTestId || undefined}
          onClose={() => setShowTestEditor(false)}
        />
      )}
    </div>
  );
};
