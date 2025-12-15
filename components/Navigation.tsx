'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Target, BarChart3, History, PlusSquare, Moon, Sun, Menu, X } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';

export default function Navigation() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lang, toggleLanguage, t } = useI18n();

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    const initial = saved === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    applyTheme(initial);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const applyTheme = (mode: 'light' | 'dark') => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', mode);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  const navItems = [
    { href: '/', label: t('nav.goals', 'Sparziele'), icon: Target },
    { href: '/analyse', label: t('nav.analysis', 'Analyse'), icon: BarChart3 },
    { href: '/verlauf', label: t('nav.history', 'Verlauf'), icon: History },
    { href: '/eingabe', label: t('nav.input', 'Eingabe'), icon: PlusSquare },
  ];

  const renderLink = (item: (typeof navItems)[number], variant: 'desktop' | 'mobile') => {
    const Icon = item.icon;
    const isActive = pathname === item.href;
    const base =
      variant === 'desktop'
        ? 'flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors'
        : 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors';

    const active = 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-200';
    const inactive =
      'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';

    return (
      <Link key={item.href} href={item.href} className={`${base} ${isActive ? active : inactive}`}>
        <Icon className="w-5 h-5" />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <nav className="border-b bg-white dark:bg-gray-900 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">$</span>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-50">SmartBudgetAI</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => renderLink(item, 'desktop'))}
              <button
                onClick={toggleLanguage}
                className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                aria-label={t('nav.switchLang', 'Sprache')}
                type="button"
              >
                <span className="text-sm font-semibold">{lang === 'de' ? 'EN' : 'DE'}</span>
              </button>
              <button
                onClick={toggleTheme}
                className="ml-3 inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                aria-label="Theme umschalten"
                type="button"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>

            <button
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              aria-label="Menü öffnen"
              onClick={() => setMobileOpen((s) => !s)}
              type="button"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div
          className={`md:hidden ${mobileOpen ? 'block' : 'hidden'} border-t border-gray-200 dark:border-gray-800 pt-3 pb-4 space-y-1`}
        >
          {navItems.map((item) => renderLink(item, 'mobile'))}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={toggleLanguage}
              className="flex-1 inline-flex items-center justify-center rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              aria-label={t('nav.switchLang', 'Sprache')}
              type="button"
            >
              <span className="text-sm font-semibold">{lang === 'de' ? 'EN' : 'DE'}</span>
            </button>
            <button
              onClick={toggleTheme}
              className="inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              aria-label="Theme umschalten"
              type="button"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
