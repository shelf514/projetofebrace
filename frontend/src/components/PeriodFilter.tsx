import type { Period } from '../types';

interface PeriodFilterProps {
  period: Period;
  onPeriodChange: (period: Period) => void;
  customStart?: string;
  customEnd?: string;
  onCustomChange?: (start: string, end: string) => void;
}

const options: { value: Period; label: string }[] = [
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Personalizado' },
];

export function PeriodFilter({ period, onPeriodChange, customStart, customEnd, onCustomChange }: PeriodFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPeriodChange(opt.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
              period === opt.value
                ? 'bg-sky-600 text-white shadow-md dark:bg-sky-500'
                : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {period === 'custom' && onCustomChange && (() => {
        const invalid = customStart && customEnd && new Date(customStart) > new Date(customEnd);
        return (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">De</label>
            <input
              type="datetime-local"
              value={customStart ?? ''}
              max={customEnd || undefined}
              onChange={(e) => onCustomChange(e.target.value, customEnd ?? '')}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            <span className="text-xs text-slate-400">—</span>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Até</label>
            <input
              type="datetime-local"
              value={customEnd ?? ''}
              min={customStart || undefined}
              onChange={(e) => onCustomChange(customStart ?? '', e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            {invalid && <span className="text-xs font-semibold text-red-600 dark:text-red-400">Início &gt; fim</span>}
          </div>
        );
      })()}
    </div>
  );
}
