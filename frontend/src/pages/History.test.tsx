import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { History } from './History';
import * as apiModule from '../services/api';

const readings = [
  {
    id: 1,
    device_id: 'AQUASENSE-001',
    timestamp: '2026-08-10T12:00:00Z',
    temperature: 25.7,
    turbidity: 12.4,
    tds: 238,
    prediction: 'boa',
    prediction_probability: 0.91,
    anomaly: false,
    created_at: '2026-08-10T12:00:00Z',
  },
  {
    id: 2,
    device_id: 'AQUASENSE-001',
    timestamp: '2026-08-10T12:10:00Z',
    temperature: 27.0,
    turbidity: 420.0,
    tds: 900,
    prediction: 'ruim',
    prediction_probability: 0.88,
    anomaly: true,
    created_at: '2026-08-10T12:10:00Z',
  },
];

describe('History', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('carrega e exibe leituras da API', async () => {
    vi.spyOn(apiModule.api, 'readings').mockResolvedValue(readings);
    render(<History />);
    expect(await screen.findAllByText('AQUASENSE-001', {}, { timeout: 2000 })).toHaveLength(2);
    expect(screen.getByText('ANOMALIA')).toBeInTheDocument();
    expect(screen.getByText('NORMAL')).toBeInTheDocument();
    expect(screen.getByText('boa')).toBeInTheDocument();
    expect(screen.getByText('ruim')).toBeInTheDocument();
  });

  it('exibe estado de erro quando a API falha', async () => {
    vi.spyOn(apiModule.api, 'readings').mockRejectedValue(new Error('Falha de rede'));
    render(<History />);
    expect(await screen.findByText('Erro de conexão', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText('Falha de rede')).toBeInTheDocument();
  });

  it('exibe estado vazio quando nao ha leituras', async () => {
    vi.spyOn(apiModule.api, 'readings').mockResolvedValue([]);
    render(<History />);
    expect(
      await screen.findByText('Nenhuma leitura com esses filtros', {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  });
});
