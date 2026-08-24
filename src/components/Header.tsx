import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';
import { LanguageToggle } from './LanguageToggle';
import { LogOut, User, LayoutDashboard, BarChart3 } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface HeaderProps {
  showNavigation?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ showNavigation = true }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 w-full px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-6">
        <BrandLogo size="sm" className="hover:opacity-90" />
        
        {user && showNavigation && (
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-3 py-2 text-zinc-600 hover:text-brand-navy hover:bg-zinc-50 rounded-lg font-medium transition-all flex items-center gap-2"
            >
              <LayoutDashboard className="w-4 h-4" />
              {t('common.dashboard')}
            </button>
            <button
              onClick={() => navigate('/admin/analytics')}
              className="px-3 py-2 text-zinc-600 hover:text-brand-navy hover:bg-zinc-50 rounded-lg font-medium transition-all flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              {t('common.analytics')}
            </button>
          </nav>
        )}
      </div>

      <div className="flex items-center gap-3">
        <LanguageToggle />
        
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-zinc-200">
            <Tooltip text={user.email || 'Admin'}>
              <div className="w-10 h-10 bg-brand-navy/5 rounded-full flex items-center justify-center text-brand-navy">
                <User className="w-5 h-5" />
              </div>
            </Tooltip>
            <Tooltip text={t('dashboard.logout')}>
              <button
                onClick={logout}
                className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
        ) : (
          <button
            onClick={() => navigate('/')}
            className="text-sm font-medium text-zinc-500 hover:text-brand-navy transition-colors px-3"
          >
            {t('common.home')}
          </button>
        )}
      </div>
    </header>
  );
};
