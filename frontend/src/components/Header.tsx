'use client';

import React from 'react';

interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onToggleSidebar?: () => void;
}

export default function Header({ theme, onToggleTheme, onToggleSidebar }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 px-4 md:px-6 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1220]">
      {/* Left: Sidebar Toggle (mobile only) */}
      <div className="flex items-center gap-2">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-md text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
        )}
        <span className="text-xl font-bold text-sky-600 dark:text-sky-400">🩺 Medibot</span>
        <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400">
          — Your AI Health Assistant
        </span>
      </div>

      {/* Right: Theme toggle */}
      <button
        onClick={onToggleTheme}
        className="p-2 rounded-md text-slate-500 dark:text-slate-300 hover:text-sky-500 transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </header>
  );
}