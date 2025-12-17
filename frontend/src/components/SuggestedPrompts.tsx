'use client';

import React from 'react';

const HeartIcon = () => <span>❤️</span>;
const EcgIcon = () => <span>🫀</span>;
const MoonIcon = () => <span>🌙</span>;

interface Prompt {
  title: string;
  question: string;
  icon: React.ReactNode;
}

interface SuggestedPromptsProps {
  onSuggestionClick: (suggestion: string) => void;
}

const prompts: Prompt[] = [
  {
    title: 'Heart Attack Symptoms',
    question: 'What are the common symptoms of a heart attack?',
    icon: <HeartIcon />,
  },
  {
    title: 'Type 1 vs Type 2 Diabetes',
    question: 'Explain the difference between Type 1 and Type 2 diabetes.',
    icon: <EcgIcon />,
  },
  {
    title: 'Improving Sleep Quality',
    question: 'What are some effective ways to improve sleep quality?',
    icon: <MoonIcon />,
  },
];

export default function SuggestedPrompts({ onSuggestionClick }: SuggestedPromptsProps) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        {prompts.map((p) => (
          <button
            key={p.title}
            onClick={() => onSuggestionClick(p.question)}
            className="group text-left p-4 transition-colors duration-200 hover:bg-white dark:hover:bg-slate-700/60 rounded-md border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
          >
            <div className="text-slate-500 dark:text-slate-300 mb-2">{p.icon}</div>
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-1">
              {p.title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{p.question}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
