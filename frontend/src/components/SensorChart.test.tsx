import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { downsample, SensorChart } from './SensorChart';

describe('downsample', () => {
  it('retorna os dados intactos se abaixo do limite', () => {
    const rows = [1, 2, 3];
    expect(downsample(rows, 10)).toEqual([1, 2, 3]);
  });

  it('reduz dados preservando o ultimo ponto', () => {
    const rows = Array.from({ length: 100 }, (_, i) => i);
    const result = downsample(rows, 10);
    expect(result).toHaveLength(10);
    expect(result[result.length - 1]).toBe(99);
  });
});

describe('SensorChart', () => {
  const data = [
    { timestamp: '2026-08-10T10:00:00Z', value: 25 },
    { timestamp: '2026-08-10T11:00:00Z', value: 26 },
    { timestamp: '2026-08-10T12:00:00Z', value: 24 },
  ];

  it('renderiza titulo e unidade', () => {
    render(<SensorChart data={data} color="#0284c7" unit="°C" label="Temperatura" />);
    expect(screen.getByText('Temperatura')).toBeInTheDocument();
    expect(screen.getByText('°C')).toBeInTheDocument();
  });

  it('exibe estado vazio quando nao ha dados', () => {
    render(<SensorChart data={data} color="#0284c7" unit="°C" label="Turbidez" />);
    expect(screen.getByRole('img', { name: /3 pontos/ })).toBeInTheDocument();
  });

  it('exibe mensagem de vazio para lista vazia', () => {
    render(<SensorChart data={[]} color="#0284c7" unit="NTU" label="Turbidez" />);
    expect(screen.getByText('Sem dados no período')).toBeInTheDocument();
  });

  it('exibe linha de referencia quando fornecida', () => {
    render(
      <SensorChart
        data={data}
        color="#0284c7"
        unit="°C"
        label="Temperatura"
        reference={{ value: 25, label: 'Ideal' }}
      />,
    );
    expect(screen.getByText(/Ideal/)).toBeInTheDocument();
  });
});
