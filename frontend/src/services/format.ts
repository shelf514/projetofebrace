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
  const latest = readings[0];
  if (!latest) return { temperature: 'sem_dados', turbidity: 'sem_dados', tds: 'sem_dados' };
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
  return { start, end };
}

export function exportCsv(readings: Reading[]): void {
  const header = 'timestamp,temperature,turbidity,tds,prediction,prediction_probability,anomaly';
  const lines = readings.map((r) =>
    [
      r.timestamp,
      r.temperature,
      r.turbidity,
      r.tds,
      r.prediction ?? '',
      r.prediction_probability ?? '',
      r.anomaly ? 'true' : 'false',
    ].join(','),
  );
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aquasense_history_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
