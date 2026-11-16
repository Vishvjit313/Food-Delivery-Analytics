import React from 'react';
import { AlertCircle } from 'lucide-react';

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className="h-28 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5"
        >
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-7 w-28 bg-slate-200 dark:bg-slate-800 rounded mt-4" />
          <div className="h-2.5 w-32 bg-slate-100 dark:bg-slate-800/60 rounded mt-3" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
      <div className="h-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
    </div>
  </div>
);

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-5 flex items-center justify-between gap-4">
    <div className="flex items-center gap-3 text-sm text-rose-800 dark:text-rose-300">
      <AlertCircle className="w-5 h-5 shrink-0" />
      <span>{message}</span>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="px-3 py-1.5 rounded-lg bg-rose-700 text-white text-xs font-medium hover:bg-rose-800 transition-colors whitespace-nowrap shrink-0"
      >
        Retry
      </button>
    )}
  </div>
);

export const CHART_COLORS = {
  primary: '#0F766E',
  secondary: '#0284C7',
  accent: '#D97706',
  success: '#16A34A',
  danger: '#DC2626',
  slate: '#64748B',
  palette: ['#0F766E', '#0284C7', '#D97706', '#4F46E5', '#16A34A', '#DC2626', '#0D9488', '#64748B'],
};

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
}

export const CustomChartTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  valueFormatter?: (val: number, name: string) => string;
}> = ({ active, payload, label, valueFormatter }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 shadow-sm text-xs">
      {label !== undefined && (
        <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const rawVal = Number(entry.value ?? 0);
          const name = String(entry.name ?? entry.dataKey ?? 'Value');
          const formatted = valueFormatter ? valueFormatter(rawVal, name) : rawVal.toLocaleString();
          return (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-xs inline-block shrink-0"
                  style={{ backgroundColor: entry.color || CHART_COLORS.primary }}
                />
                {name}
              </span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                {formatted}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
