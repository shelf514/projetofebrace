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
  neutral: 'border-slate-200 bg-white',
  ok: 'border-emerald-200 bg-emerald-50',
  warning: 'border-amber-200 bg-amber-50',
  critical: 'border-red-200 bg-red-50',
  primary: 'border-sky-200 bg-sky-50',
};

const valueTones: Record<NonNullable<StatCardProps['tone']>, string> = {
  neutral: 'text-slate-900',
  ok: 'text-emerald-700',
  warning: 'text-amber-700',
  critical: 'text-red-700',
  primary: 'text-sky-800',
};

export function StatCard({ label, value, unit, tone = 'neutral', hint, info, sub }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {info && (
          <span
            className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500"
            title={info}
          >
            ⓘ
          </span>
        )}
      </p>
      <p className={`mt-1 text-2xl font-bold ${valueTones[tone]}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span>}
      </p>
      {sub && <p className="mt-1 text-[11px] leading-snug text-slate-400">{sub}</p>}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
