import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIPage } from './AIPage';
import * as apiModule from '../services/api';
import type { MLStatus } from '../types';

const mlStatus: MLStatus = {
  model_loaded: true,
  version: '1.0.0',
  dataset: 'demo_mock.csv',
  dataset_origin: 'MOCK — dados sinteticos',
  features: ['temperature', 'turbidity', 'tds'],
  target: 'status',
  task: 'classificacao',
  model: 'RandomForestClassifier',
  n_samples: 500,
  labels: ['boa', 'atencao', 'ruim'],
  metrics: {
    accuracy: 0.95,
    precision: 0.94,
    recall: 0.93,
    f1_score: 0.935,
    confusion_matrix: {
      labels: ['boa', 'atencao', 'ruim'],
      matrix: [
        [45, 3, 2],
        [2, 38, 5],
        [1, 4, 40],
      ],
    },
  },
  feature_importance: [
    { feature: 'turbidity', importance: 0.5 },
    { feature: 'tds', importance: 0.3 },
    { feature: 'temperature', importance: 0.2 },
  ],
};

describe('AIPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('exibe loading enquanto carrega', () => {
    vi.spyOn(apiModule.api, 'mlStatus').mockReturnValue(new Promise(() => {}));
    render(<AIPage />);
    expect(screen.getByText('Carregando informações do modelo...')).toBeInTheDocument();
  });

  it('exibe aviso quando modelo nao esta carregado', async () => {
    vi.spyOn(apiModule.api, 'mlStatus').mockResolvedValue({ model_loaded: false });

    render(<AIPage />);
    expect(await screen.findByText(/Nenhum modelo treinado/i, {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('exibe metricas do modelo quando carregado', async () => {
    vi.spyOn(apiModule.api, 'mlStatus').mockResolvedValue(mlStatus);

    render(<AIPage />);
    expect(await screen.findByText('RandomForestClassifier', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText('demo_mock.csv')).toBeInTheDocument();
    expect(screen.getByText('Acurácia')).toBeInTheDocument();
  });

  it('exibe matriz de confusao', async () => {
    vi.spyOn(apiModule.api, 'mlStatus').mockResolvedValue(mlStatus);

    render(<AIPage />);
    await screen.findByText('RandomForestClassifier', {}, { timeout: 2000 });
    expect(screen.getByText('Matriz de confusão')).toBeInTheDocument();
  });

  it('exibe importancia das features', async () => {
    vi.spyOn(apiModule.api, 'mlStatus').mockResolvedValue(mlStatus);

    render(<AIPage />);
    await screen.findByText('RandomForestClassifier', {}, { timeout: 2000 });
    expect(screen.getByText('Importância das variáveis')).toBeInTheDocument();
  });

  it('exibe erro quando API falha', async () => {
    vi.spyOn(apiModule.api, 'mlStatus').mockRejectedValue(new Error('falha ml'));

    render(<AIPage />);
    expect(await screen.findByText('falha ml', {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('exibe secao de aquarismo', async () => {
    vi.spyOn(apiModule.api, 'mlStatus').mockResolvedValue(mlStatus);

    render(<AIPage />);
    await screen.findByText('RandomForestClassifier', {}, { timeout: 2000 });
    expect(screen.getByText(/Aquarismo — IA por espécie/i)).toBeInTheDocument();
  });
});
