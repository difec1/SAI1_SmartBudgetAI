'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Target, BarChart3, History, PlusSquare, Moon, Sun } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    const initial = saved === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    applyTheme(initial);
  }, []);

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
    { href: '/', label: 'Sparziele', icon: Target },
    { href: '/analyse', label: 'Analyse', icon: BarChart3 },
    { href: '/verlauf', label: 'Verlauf', icon: History },
    { href: '/eingabe', label: 'Eingabe', icon: PlusSquare },
  ];

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

          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors
                    ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-200'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={toggleTheme}
              className="ml-3 inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
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
