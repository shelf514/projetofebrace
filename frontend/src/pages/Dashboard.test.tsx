import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import * as apiModule from '../services/api';
import type { Device, Health, MLStatus, Reading } from '../types';

const health: Health = {
  status: 'ok',
  database: 'ok',
  model_loaded: true,
  model_version: '1.0.0',
  model_trained_at: '2026-08-10T12:00:00Z',
  uptime_seconds: 10,
};

const mlStatus: MLStatus = {
  model_loaded: true,
  version: '1.0.0',
  dataset: 'dataset.csv',
  dataset_origin: 'Coletado em campo',
  features: ['temperature', 'turbidity', 'tds'],
  target: 'status',
  task: 'classificacao',
  model: 'RandomForestClassifier',
  n_samples: 1200,
  labels: ['boa', 'atencao', 'ruim'],
  feature_importance: [
    { feature: 'turbidity', importance: 0.62 },
    { feature: 'tds', importance: 0.28 },
    { feature: 'temperature', importance: 0.1 },
  ],
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

const devices: Device[] = [
  {
    id: 'AQUASENSE-001',
    name: 'Dispositivo teste',
    api_key: null,
    last_seen: '2026-08-10T12:00:00Z',
    status: 'online',
    created_at: '2026-08-10T12:00:00Z',
  },
];

function mockApi(overrides: Partial<Record<'health' | 'latestReading' | 'devices' | 'history' | 'mlStatus', unknown>> = {}) {
  vi.spyOn(apiModule.api, 'health').mockResolvedValue((overrides.health as Health) ?? health);
  vi.spyOn(apiModule.api, 'latestReading').mockResolvedValue((overrides.latestReading as Reading) ?? latest);
  vi.spyOn(apiModule.api, 'devices').mockResolvedValue((overrides.devices as Device[]) ?? devices);
  vi.spyOn(apiModule.api, 'history').mockResolvedValue((overrides.history as Reading[]) ?? [latest]);
  vi.spyOn(apiModule.api, 'mlStatus').mockResolvedValue((overrides.mlStatus as MLStatus) ?? mlStatus);
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza cards com a ultima leitura', async () => {
    mockApi();

    render(<Dashboard />);
    expect(await screen.findByText('25.7', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText('12.4')).toBeInTheDocument();
    expect(screen.getByText('238')).toBeInTheDocument();
    expect(screen.getByText('boa')).toBeInTheDocument();
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
  });

  it('exibe erro quando a API esta indisponivel', async () => {
    vi.spyOn(apiModule.api, 'health').mockRejectedValue(new Error('conexão recusada'));
    vi.spyOn(apiModule.api, 'latestReading').mockRejectedValue(new Error('conexão recusada'));
    vi.spyOn(apiModule.api, 'devices').mockRejectedValue(new Error('conexão recusada'));
    vi.spyOn(apiModule.api, 'history').mockRejectedValue(new Error('conexão recusada'));
    vi.spyOn(apiModule.api, 'mlStatus').mockRejectedValue(new Error('conexão recusada'));

    render(<Dashboard />);
    const errors = await screen.findAllByText('Erro de conexão', {}, { timeout: 2000 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('exibe saudacao do modelo e confianca', async () => {
    mockApi();

    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Confiança: 91%')).toBeInTheDocument(), { timeout: 2000 });
  });

  it('explica os fatores da ultima previsao', async () => {
    mockApi();

    render(<Dashboard />);
    await waitFor(
      () => expect(screen.getByText('Por que essa previsão?')).toBeInTheDocument(),
      { timeout: 2000 },
    );
    expect(screen.getByText('turbidity')).toBeInTheDocument();
    expect(screen.getByText('tds')).toBeInTheDocument();
    expect(screen.getByText('temperature')).toBeInTheDocument();
  });

  it('nao mostra selo DEMO para dados reais', async () => {
    mockApi();

    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('ONLINE')).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.queryByText(/dados simulados/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dataset mock/i)).not.toBeInTheDocument();
  });

  it('mostra selo DEMO quando a leitura vem de dispositivo simulado', async () => {
    mockApi({
      latestReading: { ...latest, device_id: 'AQUASENSE-SIM' },
    });

    render(<Dashboard />);
    await waitFor(
      () => expect(screen.getByText(/DEMO — dados simulados/i)).toBeInTheDocument(),
      { timeout: 2000 },
    );
  });

  it('mostra selo de modelo DEMO quando o dataset e MOCK', async () => {
    mockApi({ mlStatus: { ...mlStatus, dataset_origin: 'MOCK — dados sinteticos para testes' } });

    render(<Dashboard />);
    await waitFor(
      () => expect(screen.getByText(/Modelo DEMO/i)).toBeInTheDocument(),
      { timeout: 2000 },
    );
  });
});
