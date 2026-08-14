import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ConfusionMatrixView } from '../components/ConfusionMatrix';
import { ErrorState, LoadingState } from '../components/States';
import { StatCard } from '../components/StatCard';
import { usePolling } from '../hooks/usePolling';
import { api } from '../services/api';
import { featureLabel } from '../services/format';
import type { ConfusionMatrix } from '../types';

export function AIPage() {
  const { data: status, error, refresh } = usePolling(() => api.mlStatus(), 30000);

  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!status) return <LoadingState message="Carregando informações do modelo..." />;

  if (!status.model_loaded) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800">IA / Modelo</h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          <p className="font-semibold">Nenhum modelo treinado ainda.</p>
          <p className="mt-1">
            Treine o modelo executando <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">python -m ml.train</code> no
            backend, ou use o dataset demo.
          </p>
        </div>
      </div>
    );
  }

  const metrics = status.metrics ?? {};
  const cm = metrics.confusion_matrix as ConfusionMatrix | undefined;
  const regression = ['mae', 'rmse', 'r2'].filter((k) => k in metrics);
  const featureImportance = (status.feature_importance ?? []).map((item) => ({
    ...item,
    feature: featureLabel(item.feature),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">IA / Modelo</h2>
          <p className="text-sm text-slate-500">
            Modelo v{status.version ?? '?'} · treinado em {status.trained_at ? new Date(status.trained_at).toLocaleString('pt-BR') : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
        >
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Modelo" value={status.model ?? '—'} tone="primary" />
        <StatCard label="Tarefa" value={status.task === 'classification' ? 'Classificação' : status.task === 'regression' ? 'Regressão' : (status.task ?? '—')} tone="neutral" />
        <StatCard label="Variável-alvo" value={status.target ?? '—'} tone="neutral" />
        <StatCard label="Amostras" value={status.n_samples ?? '—'} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Fonte dos dados</h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Dataset</dt>
              <dd className="font-mono text-xs text-slate-700">{status.dataset ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Origem</dt>
              <dd className="text-xs text-slate-700">{status.dataset_origin ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Variáveis (features)</dt>
              <dd className="text-xs text-slate-700">{(status.features ?? []).map(featureLabel).join(', ')}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Rótulos</dt>
              <dd className="text-xs text-slate-700">{status.labels ? status.labels.join(', ') : '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Métricas</h3>
          {cm ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Acurácia" value={((metrics.accuracy as number) * 100).toFixed(1)} unit="%" tone="ok" />
              <StatCard label="Precisão" value={((metrics.precision as number) * 100).toFixed(1)} unit="%" tone="neutral" />
              <StatCard label="Recall" value={((metrics.recall as number) * 100).toFixed(1)} unit="%" tone="neutral" />
              <StatCard label="F1-score" value={((metrics.f1_score as number) * 100).toFixed(1)} unit="%" tone="neutral" />
            </div>
          ) : regression.length === 3 ? (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="MAE" value={Number(metrics.mae).toFixed(3)} tone="neutral" />
              <StatCard label="RMSE" value={Number(metrics.rmse).toFixed(3)} tone="neutral" />
              <StatCard label="R²" value={Number(metrics.r2).toFixed(3)} tone={Number(metrics.r2) > 0.8 ? 'ok' : 'warning'} />
            </div>
          ) : (
            <p className="text-sm text-slate-400">Métricas não disponíveis para este modelo.</p>
          )}
        </div>
      </div>

      {status.overfitting && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Verificação de sobreajuste (overfitting)</h3>
            {status.overfitting.warning && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">ALERTA DE SOBREAJUSTE</span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Desempenho em treino" value={status.overfitting.train_score.toFixed(3)} tone="neutral" />
            <StatCard label="Desempenho em teste" value={status.overfitting.test_score.toFixed(3)} tone="neutral" />
            <StatCard
              label="Diferença (treino − teste)"
              value={status.overfitting.overfit_gap.toFixed(3)}
              tone={status.overfitting.warning ? 'warning' : 'ok'}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cm && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Matriz de confusão</h3>
            <ConfusionMatrixView cm={cm} />
          </div>
        )}

        {status.feature_importance && status.feature_importance.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Importância das variáveis</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureImportance} layout="vertical" margin={{ top: 5, right: 20, bottom: 0, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fill: '#64748b' }} width={120} />
                  <Tooltip formatter={(value) => [Number(value).toFixed(4), 'Importância']} />
                  <Bar dataKey="importance" fill="#0284c7" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        <p>
          <strong>Limitação científica:</strong> este modelo foi treinado sobre {(status.dataset ?? 'um dataset').toUpperCase()}
          {status.dataset_origin?.toLowerCase().includes('mock') && ' (dados sintéticos, apenas para demonstração)'}. As
          previsões são saídas estatísticas e não certificam a potabilidade da água.
        </p>
        <p className="mt-2 text-[11px] text-amber-700">
          Glossário: <strong>Recall</strong> = capacidade de achar os casos verdadeiros · <strong>F1-score</strong> =
          equilíbrio entre precisão e recall · <strong>MAE/RMSE</strong> = erros médios (regressão) ·{' '}
          <strong>sobreajuste (overfitting)</strong> = o modelo "decora" o treino e vai mal em dados novos ·{' '}
          <strong>acurácia</strong> = % de acertos · <strong>precisão</strong> = % dos acertos que eram de fato o alvo.
        </p>
      </div>
    </div>
  );
}
