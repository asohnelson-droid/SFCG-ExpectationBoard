import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Tooltip } from '../components/Tooltip';
import { BackButton } from '../components/BackButton';
import { Info, Sparkles, Check } from 'lucide-react';
import { motion } from 'motion/react';

export const CreateEventPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const generateEventCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title) return;

    setIsCreating(true);
    const eventCode = generateEventCode();
    const slug = `${slugify(title)}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      const { error } = await supabase.from('events').insert({
        title,
        description,
        event_code: eventCode,
        slug,
        status: 'active',
        created_by: user.id,
      });
      if (error) throw error;
      navigate('/dashboard');
    } catch (err) {
      console.error('Create event error:', err);
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-6 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full bg-white p-8 rounded-3xl border border-zinc-200 shadow-xl space-y-8"
      >
        <div className="flex items-center justify-between">
          <BackButton fallbackPath="/dashboard" tooltip={t('createEvent.back')} />
          <h1 className="text-2xl font-bold text-brand-navy">{t('createEvent.title')}</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
              {t('createEvent.eventTitle')}
              <Tooltip text={t('createEvent.eventTitleTooltip')}>
                <Info className="w-4 h-4 text-zinc-400 cursor-help" />
              </Tooltip>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('createEvent.eventTitlePlaceholder')}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
              {t('createEvent.description')}
              <Tooltip text={t('createEvent.descriptionTooltip')}>
                <Info className="w-4 h-4 text-zinc-400 cursor-help" />
              </Tooltip>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('createEvent.descriptionPlaceholder')}
              rows={4}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
            />
          </div>

          <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 flex items-start gap-4">
            <div className="p-2 bg-primary text-white rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-brand-navy">{t('createEvent.autoSetup')}</p>
              <p className="text-xs text-zinc-500">{t('createEvent.autoSetupSubtitle')}</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isCreating || !title}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
          >
            {isCreating ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Check className="w-5 h-5" />
                {t('createEvent.submit')}
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
