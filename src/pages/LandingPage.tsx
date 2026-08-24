import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Tooltip } from '../components/Tooltip';
import { LanguageToggle } from '../components/LanguageToggle';
import { LogIn, ArrowRight, Info, Search } from 'lucide-react';
import { motion } from 'motion/react';

import { BrandLogo } from '../components/BrandLogo';

export const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, signIn, isSigningIn, authError, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [eventCode, setEventCode] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (eventCode.length !== 6) {
      setError(t('landing.errors.invalidCode'));
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('events')
        .select('slug, status')
        .eq('event_code', eventCode.toUpperCase())
        .maybeSingle();

      if (queryError) throw queryError;

      if (!data) {
        setError(t('landing.errors.eventNotFound'));
      } else if (data.status === 'closed') {
        setError(t('landing.errors.eventClosed'));
      } else {
        navigate(`/event/${data.slug}/submit`);
      }
    } catch (err) {
      console.error('Join error:', err);
      setError(t('landing.errors.generalError'));
    } finally {
      setIsJoining(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col p-0 overflow-hidden bg-zinc-50">
      {/* Navbar */}
      <nav className="w-full bg-white/60 backdrop-blur-md border-b border-zinc-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <BrandLogo size="sm" className="hover:opacity-90" />
        <div className="flex items-center gap-4">
          <LanguageToggle />
          {!user && (
            <button
              onClick={() => signIn()}
              disabled={isSigningIn}
              className="flex items-center gap-2 px-4 py-2 text-zinc-600 hover:text-brand-navy font-medium transition-colors disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              {t('landing.facilitatorLogin')}
            </button>
          )}
          {user && (
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 bg-brand-navy text-white rounded-xl font-semibold hover:bg-brand-navy/90 transition-all shadow-sm"
            >
              {t('common.dashboard')}
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Background Image with Overlay */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=2070")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-8 text-center relative z-10"
        >
          <div className="flex flex-col items-center space-y-4">
            <BrandLogo size="lg" className="mb-2" />
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tighter text-brand-navy">{t('common.expectationBoard')}</h1>
              <p className="text-zinc-500 text-sm font-medium">{t('landing.tagline')}</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-brand-navy flex items-center justify-center gap-2">
                {t('landing.joinAsParticipant')}
                <Tooltip text={t('landing.codeTooltip')}>
                  <Info className="w-4 h-4 text-zinc-400 cursor-help" />
                </Tooltip>
              </h2>
              <form onSubmit={handleJoin} className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={eventCode}
                    onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                    placeholder={t('landing.enterCode')}
                    maxLength={6}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Tooltip text={t('landing.searchTooltip')}>
                      <Search className="w-5 h-5 text-zinc-400" />
                    </Tooltip>
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={isJoining || eventCode.length !== 6}
                  className="w-full py-3 bg-primary text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {isJoining ? t('common.joining') : t('landing.joinEvent')}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-zinc-400">{t('landing.facilitators')}</span>
              </div>
            </div>

            <div className="space-y-4">
              {user ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full py-3 bg-white border border-zinc-200 text-brand-navy rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors"
                >
                  {t('common.goToDashboard')}
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={signIn}
                    disabled={isSigningIn}
                    className="w-full py-3 bg-white border border-zinc-200 text-brand-navy rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  >
                    {isSigningIn ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                    ) : (
                      <LogIn className="w-5 h-5" />
                    )}
                    {isSigningIn ? t('common.signingIn') : t('common.signInWithGoogle')}
                    {!isSigningIn && (
                      <Tooltip text={t('landing.signInTooltip')}>
                        <Info className="w-4 h-4 text-zinc-400 cursor-help" />
                      </Tooltip>
                    )}
                  </button>
                  {authError && (
                    <div className="space-y-2">
                      <p className="text-red-500 text-xs font-medium">{authError}</p>
                      <button
                        onClick={() => {
                          const debugInfo = {
                            hostname: window.location.hostname,
                            href: window.location.href,
                            userAgent: navigator.userAgent,
                          };
                          console.log('Auth Debug Info:', debugInfo);
                          alert(`Debug Info (also in console):\nDomain: ${window.location.hostname}`);
                        }}
                        className="text-[10px] text-zinc-400 hover:text-zinc-600 underline"
                      >
                        {t('landing.showDebug')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
