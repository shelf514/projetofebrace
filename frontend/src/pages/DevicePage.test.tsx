import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DevicePage } from './DevicePage';
import * as apiModule from '../services/api';
import type { Device, Reading } from '../types';

const device: Device = {
  id: 'AQUASENSE-001',
  name: 'Dispositivo teste',
  api_key: null,
  last_seen: '2026-08-10T12:00:00Z',
  status: 'online',
  created_at: '2026-08-10T12:00:00Z',
};

const latest: Reading = {
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
};

describe('DevicePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exibe loading enquanto carrega', () => {
    vi.spyOn(apiModule.api, 'devices').mockReturnValue(new Promise(() => {}));
    render(<DevicePage />);
    expect(screen.getByText('Carregando dispositivos...')).toBeInTheDocument();
  });

  it('exibe dispositivos com status', async () => {
    vi.spyOn(apiModule.api, 'devices').mockResolvedValue([device]);
    vi.spyOn(apiModule.api, 'latestReading').mockResolvedValue(latest);

    render(<DevicePage />);
    expect(await screen.findByText('AQUASENSE-001', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText('Dispositivo teste')).toBeInTheDocument();
    expect(screen.getAllByText('ONLINE').length).toBeGreaterThan(0);
  });

  it('exibe mensagem quando nao ha dispositivos', async () => {
    vi.spyOn(apiModule.api, 'devices').mockResolvedValue([]);

    render(<DevicePage />);
    expect(
      await screen.findByText(/Nenhum dispositivo registrado/i, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  });

  it('exibe erro quando API falha', async () => {
    vi.spyOn(apiModule.api, 'devices').mockRejectedValue(new Error('falha rede'));

    render(<DevicePage />);
    expect(await screen.findByText('falha rede', {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('exibe card de ultima comunicacao', async () => {
    vi.spyOn(apiModule.api, 'devices').mockResolvedValue([device]);
    vi.spyOn(apiModule.api, 'latestReading').mockResolvedValue(latest);

    render(<DevicePage />);
    await screen.findByText('AQUASENSE-001', {}, { timeout: 2000 });
    expect(screen.getByText('Última comunicação')).toBeInTheDocument();
  });
});
