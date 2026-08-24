import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { mapEvent } from '../lib/mappers';
import { Tooltip } from '../components/Tooltip';
import { Plus, Settings, MoreVertical, Search, Filter, Trash2, ExternalLink, Calendar, Users, Eye, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { BrandLogo } from '../components/BrandLogo';
import { LanguageToggle } from '../components/LanguageToggle';

import { Header } from '../components/Header';

export const FacilitatorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'closed'>('all');

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const loadEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading events:', error);
      } else {
        setEvents((data || []).map(mapEvent));
      }
      setLoading(false);
    };

    loadEvents();

    const channel = supabase
      .channel(`facilitator-events-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `created_by=eq.${user.id}` },
        () => loadEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const handleDelete = async (id: string) => {
    if (window.confirm(t('dashboard.deleteConfirm'))) {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) console.error('Delete error:', error);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const { error } = await supabase
      .from('events')
      .update({ status: currentStatus === 'active' ? 'closed' : 'active' })
      .eq('id', id);
    if (error) console.error('Update status error:', error);
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || event.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Header />

      <main className="flex-1 p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-brand-navy">{t('dashboard.title')}</h1>
              <p className="text-zinc-500 text-sm font-medium">{t('dashboard.subtitle')}</p>
            </div>

            <div className="flex items-center gap-3">
              <Tooltip text={t('dashboard.createNewEvent')}>
                <button
                  onClick={() => navigate('/create-event')}
                  className="px-6 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-primary-dark transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  {t('dashboard.newEvent')}
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder={t('dashboard.searchEvents')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Tooltip text={t('dashboard.filterOptions')}>
                <Filter className="w-4 h-4 text-zinc-400 cursor-pointer" />
              </Tooltip>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'active', 'closed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filterStatus === status
                    ? 'bg-primary text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {t(`dashboard.status.${status}`)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredEvents.map((event) => (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow group relative"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      event.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {t(`dashboard.status.${event.status}`)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Tooltip text={t('dashboard.viewLive')}>
                        <button
                          onClick={() => navigate(`/event/${event.slug}/live`)}
                          className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-brand-navy"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </Tooltip>
                      <Tooltip text={t('dashboard.moreOptions')}>
                        <button className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-brand-navy mb-2 group-hover:text-primary transition-colors">
                    {event.title}
                  </h3>
                  <p className="text-zinc-500 text-sm line-clamp-2 mb-6">
                    {event.description || t('dashboard.noDescription')}
                  </p>

                  <div className="flex items-center gap-4 text-zinc-400 text-xs mb-6">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {event.createdAt ? format(new Date(event.createdAt), 'MMM d, yyyy') : t('dashboard.recently')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {t('dashboard.code')} <span className="font-mono font-bold text-brand-navy">{event.eventCode}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                    <div className="flex items-center gap-2">
                      <Tooltip text={t('dashboard.manageEvent')}>
                        <button
                          onClick={() => navigate(`/event/${event.slug}`)}
                          className="p-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </Tooltip>
                      <Tooltip text={event.status === 'active' ? t('dashboard.closeEvent') : t('dashboard.openEvent')}>
                        <button
                          onClick={() => toggleStatus(event.id, event.status)}
                          className={`p-2 rounded-lg border border-zinc-200 transition-colors ${
                            event.status === 'active' ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-emerald-50 hover:text-emerald-600'
                          }`}
                        >
                          <Plus className={`w-4 h-4 ${event.status === 'active' ? 'rotate-45' : ''} transition-transform`} />
                        </button>
                      </Tooltip>
                    </div>
                    <Tooltip text={t('dashboard.deleteEvent')}>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-zinc-300">
            <div className="max-w-xs mx-auto space-y-4">
              <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
                <Plus className="w-8 h-8 text-zinc-400" />
              </div>
              <h3 className="text-xl font-bold text-brand-navy">{t('dashboard.noEvents')}</h3>
              <p className="text-zinc-500">{t('dashboard.noEventsSubtitle')}</p>
              <button
                onClick={() => navigate('/create-event')}
                className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors shadow-sm"
              >
                {t('dashboard.createFirstEvent')}
              </button>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
};
