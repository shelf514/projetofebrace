import type { Period } from '../types';

interface PeriodFilterProps {
  period: Period;
  onPeriodChange: (period: Period) => void;
  customStart?: string;
  customEnd?: string;
  onCustomChange?: (start: string, end: string) => void;
}

const options: { value: Period; label: string }[] = [
  { value: '24h', label: 'Últimas 24 horas' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Período personalizado' },
];

export function PeriodFilter({ period, onPeriodChange, customStart, customEnd, onCustomChange }: PeriodFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onPeriodChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            period === opt.value
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
      {period === 'custom' && onCustomChange && (
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={customStart ?? ''}
            onChange={(e) => onCustomChange(e.target.value, customEnd ?? '')}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
          />
          <span className="text-xs text-slate-500">até</span>
          <input
            type="datetime-local"
            value={customEnd ?? ''}
            onChange={(e) => onCustomChange(customStart ?? '', e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
          />
        </div>
      )}
    </div>
  );
}
