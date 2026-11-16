import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  context: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  context,
  icon: Icon,
  tone = 'neutral',
}) => {
  const toneText =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'warning'
      ? 'text-amber-700 dark:text-amber-400'
      : tone === 'danger'
      ? 'text-rose-700 dark:text-rose-400'
      : 'text-slate-500 dark:text-slate-400';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-colors duration-150 hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 truncate">
          {label}
        </span>
        <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums font-display">
        {value}
      </div>
      <div className={`mt-1.5 text-xs font-medium ${toneText} truncate`}>
        {context}
      </div>
    </div>
  );
};
