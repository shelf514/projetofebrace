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

interface SensorChartProps {
  data: { timestamp: string; value: number }[];
  color: string;
  unit: string;
  label: string;
  reference?: { value: number; label: string };
}

export function SensorChart({ data, color, unit, label, reference }: SensorChartProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
        <span className="text-xs text-slate-400">({unit})</span>
      </div>
      {reference && (
        <p className="mb-2 text-[11px] text-amber-700">
          Linha tracejada: {reference.label} (comparação contextual — não é certificação)
        </p>
      )}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(v: string) => new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              minTickGap={40}
            />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip
              labelFormatter={(v) => new Date(String(v)).toLocaleString('pt-BR')}
              formatter={(value) => [`${Number(value).toFixed(2)} ${unit}`, label]}
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
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
