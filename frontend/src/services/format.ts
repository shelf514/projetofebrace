import type { Reading } from '../types';

export const SOFT_BOUNDS = {
  temperature: [-5, 45],
  turbidity: [0, 1000],
  tds: [0, 2000],
} as const;

export const FEATURE_LABELS: Record<string, string> = {
  temperature: 'Temperatura',
  turbidity: 'Turbidez',
  tds: 'TDS (sólidos dissolvidos)',
};

export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}

export function sensorStatus(readings: Reading[]): Record<'temperature' | 'turbidity' | 'tds', 'ok' | 'attention' | 'sem_dados'> {
  if (readings.length === 0) return { temperature: 'sem_dados', turbidity: 'sem_dados', tds: 'sem_dados' };
  const latest = readings.reduce((a, b) => (new Date(a.timestamp).getTime() >= new Date(b.timestamp).getTime() ? a : b));
  return {
    temperature: inBounds(latest.temperature, SOFT_BOUNDS.temperature) ? 'ok' : 'attention',
    turbidity: inBounds(latest.turbidity, SOFT_BOUNDS.turbidity) ? 'ok' : 'attention',
    tds: inBounds(latest.tds, SOFT_BOUNDS.tds) ? 'ok' : 'attention',
  };
}

function inBounds(value: number, [low, high]: readonly number[]): boolean {
  return value >= low && value <= high;
}

export function periodRange(period: '24h' | '7d' | '30d' | 'custom', customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const end = customEnd ?? new Date();
  let start: Date;
  switch (period) {
    case '24h':
      start = new Date(end.getTime() - 24 * 3600 * 1000);
      break;
    case '7d':
      start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
      break;
    case '30d':
      start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
      break;
    case 'custom':
      start = customStart ?? new Date(end.getTime() - 24 * 3600 * 1000);
      break;
  }
  if (start > end) throw new Error('Período inválido: início após o fim');
  return { start, end };
}

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Anti CSV-injection: prefixa ' se começa com =,+,-,@,tab
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCsv(readings: Reading[]): void {
  const header = 'timestamp,temperature,turbidity,tds,prediction,prediction_probability,anomaly';
  const lines = readings.map((r) =>
    [
      csvCell(r.timestamp),
      csvCell(r.temperature),
      csvCell(r.turbidity),
      csvCell(r.tds),
      csvCell(r.prediction ?? ''),
      csvCell(r.prediction_probability ?? ''),
      csvCell(r.anomaly ? 'true' : 'false'),
    ].join(','),
  );
  const csvContent = `\uFEFF${[header, ...lines].join('\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const day = new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-');
  link.download = `aquasense_history_${day}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
