import { useCallback, useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from './ThemeProvider';

interface SensorChartProps {
  data: { timestamp: string; value: number }[];
  color: string;
  unit: string;
  label: string;
  reference?: { value: number; label: string };
}

const MAX_POINTS = 300;

/** Downsample uniforme: 5000pts -> 300 (evita ~15k nos SVG e jank a cada poll). */
export function downsample<T>(rows: T[], max = MAX_POINTS): T[] {
  if (rows.length <= max) return rows;
  const step = rows.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(rows[Math.floor(i * step)]);
  return out;
}

export function SensorChart({ data, color, unit, label, reference }: SensorChartProps) {
  const tickFormatter = useCallback(
    (v: string) => new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    [],
  );
  const labelFormatter = useCallback((v: unknown) => new Date(String(v)).toLocaleString('pt-BR'), []);
  const valueFormatter = useCallback(
    (value: unknown) => [`${Number(value).toFixed(2)} ${unit}`, label] as [string, string],
    [unit, label],
  );
  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
    return downsample(sorted);
  }, [data]);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {unit}
        </span>
      </div>
      {reference && (
        <p className="mb-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          ━ {reference.label} (referência)
        </p>
      )}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sortedData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
              tickFormatter={tickFormatter}
              minTickGap={40}
              axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
              tickLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
              axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
              tickLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                borderRadius: '12px',
                color: isDark ? '#f1f5f9' : '#0f172a',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }}
              labelFormatter={labelFormatter}
              formatter={valueFormatter}
            />
            {reference && (
              <ReferenceLine
                y={reference.value}
                stroke="#d97706"
                strokeDasharray="6 3"
                label={{ value: reference.label, fontSize: 10, fill: '#d97706', position: 'insideTopRight' }}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
