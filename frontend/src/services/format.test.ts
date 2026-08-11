import { describe, expect, it } from 'vitest';
import { periodRange, sensorStatus } from './format';
import type { Reading } from '../types';

describe('sensorStatus', () => {
  it('retorna sem_dados quando nao ha leituras', () => {
    expect(sensorStatus([])).toEqual({
      temperature: 'sem_dados',
      turbidity: 'sem_dados',
      tds: 'sem_dados',
    });
  });

  it('marca ok para valores dentro dos limites', () => {
    const readings = [{ temperature: 25, turbidity: 12, tds: 200 } as Reading];
    expect(sensorStatus(readings)).toEqual({
      temperature: 'ok',
      turbidity: 'ok',
      tds: 'ok',
    });
  });

  it('marca attention para valores fora dos limites', () => {
    const readings = [{ temperature: 60, turbidity: 12, tds: 200 } as Reading];
    expect(sensorStatus(readings)).toEqual({
      temperature: 'attention',
      turbidity: 'ok',
      tds: 'ok',
    });
  });
});

describe('periodRange', () => {
  it('calcula janela de 24 horas', () => {
    const end = new Date('2026-08-10T12:00:00Z');
    const { start } = periodRange('24h', undefined, end);
    expect((end.getTime() - start.getTime()) / 3600 / 1000).toBe(24);
  });

  it('calcula janela de 7 dias', () => {
    const end = new Date('2026-08-10T12:00:00Z');
    const { start } = periodRange('7d', undefined, end);
    expect((end.getTime() - start.getTime()) / 24 / 3600 / 1000).toBe(7);
  });

  it('calcula janela de 30 dias', () => {
    const end = new Date('2026-08-10T12:00:00Z');
    const { start } = periodRange('30d', undefined, end);
    expect((end.getTime() - start.getTime()) / 24 / 3600 / 1000).toBe(30);
  });
});
