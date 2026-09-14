import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: 'neutral' | 'ok' | 'warning' | 'critical' | 'primary';
  hint?: string;
  info?: string;
  sub?: string;
}

const tones: Record<NonNullable<StatCardProps['tone']>, string> = {
  neutral: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
  ok: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/40',
  warning: 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/40',
  critical: 'border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/40',
  primary: 'border-sky-200 bg-sky-50 dark:border-sky-800/50 dark:bg-sky-950/40',
};

const valueTones: Record<NonNullable<StatCardProps['tone']>, string> = {
  neutral: 'text-slate-900 dark:text-slate-100',
  ok: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-700 dark:text-amber-300',
  critical: 'text-red-700 dark:text-red-300',
  primary: 'text-sky-800 dark:text-sky-300',
};

export function StatCard({ label, value, unit, tone = 'neutral', hint, info, sub }: StatCardProps) {
  return (
    <div
      className={`group rounded-2xl border p-4 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/20 ${tones[tone]}`}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
        {info && (
          <span
            className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300"
            title={info}
          >
            ⓘ
          </span>
        )}
      </p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${valueTones[tone]}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-slate-400 dark:text-slate-500">{unit}</span>}
      </p>
      {sub && <p className="mt-1 text-[11px] leading-snug text-slate-400 dark:text-slate-500">{sub}</p>}
      {hint && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}
