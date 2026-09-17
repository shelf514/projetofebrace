import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AquarismoRecomendador, CatalogoEspecies } from '../components/AquarismoRecomendador';
import { ConfusionMatrixView } from '../components/ConfusionMatrix';
import { ErrorState, LoadingState } from '../components/States';
import { StatCard } from '../components/StatCard';
import { usePolling } from '../hooks/usePolling';
import { api } from '../services/api';
import { featureLabel } from '../services/format';
import type { ConfusionMatrix } from '../types';

export function AIPage() {
  const { data: status, error, refresh } = usePolling(() => api.mlStatus(), 30000);
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!status) return <LoadingState message="Carregando informações do modelo..." />;

  const renderAquarismo = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 p-4 dark:border-sky-800/30 dark:from-sky-950/20 dark:to-cyan-950/20">
        <h2 className="text-sm font-extrabold tracking-tight text-sky-900 dark:text-sky-100">🐠 Aquarismo — IA por espécie</h2>
        <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">Recomendações de pH, temperatura, TDS, GH, volume e compatibilidade para 15 espécies. Chat offline-first com memória 30 min. Fonte: aquarismo.json + diagnostico dos sensores.</p>
      </div>
      <AquarismoRecomendador />
      <CatalogoEspecies />
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-800 dark:border-sky-800/30 dark:bg-sky-950/30 dark:text-sky-300">
        <p><strong>💬 O chat mudou:</strong> agora ele vive no botão flutuante no canto inferior direito, disponível em todas as páginas.</p>
      </div>
    </div>
  );

  if (!status.model_loaded) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent dark:from-white dark:to-slate-300">IA</h2>
          <button type="button" onClick={refresh} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-md dark:bg-white dark:text-slate-900">↻ Atualizar</button>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="font-semibold">Nenhum modelo treinado ainda.</p>
          <p className="mt-1">Treine com <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">python -m ml.train</code> ou use o dataset demo.</p>
        </div>
        {renderAquarismo()}
      </div>
    );
  }

  const metrics = status.metrics ?? {};
  const cm = metrics.confusion_matrix as ConfusionMatrix | undefined;
  const regression = ['mae', 'rmse', 'r2'].filter((k) => k in metrics);
  const isMockModel = /mock|demo|simulado|sint[eé]tico/i.test(status.dataset_origin ?? status.dataset ?? '');
  const accuracy = typeof metrics.accuracy === 'number' ? metrics.accuracy : null;
  // Distribuição por classe a partir das colunas da matriz (rótulo real).
  const classCounts: number[] | null =
    cm && Array.isArray(cm.matrix) && cm.matrix.length > 0
      ? cm.matrix[0].map((_, col) => cm.matrix.reduce((sum, row) => sum + (row[col] ?? 0), 0))
      : null;
  const minorityShare =
    classCounts && classCounts.length > 1
      ? Math.min(...classCounts) / Math.max(1, classCounts.reduce((a, b) => a + b, 0))
      : null;
  const showTrivialAccuracyNote = isMockModel && accuracy === 1;
  const featureImportance = (status.feature_importance ?? []).map((item) => ({
    ...item,
    feature: featureLabel(item.feature),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent dark:from-white dark:to-slate-300">IA</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Modelo v{status.version ?? '?'} · treinado em {status.trained_at ? new Date(status.trained_at).toLocaleString('pt-BR') : '—'} · Aquarismo 15 espécies
          </p>
        </div>
        <button type="button" onClick={refresh} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg active:scale-[0.98] dark:bg-white dark:text-slate-900">↻ Atualizar</button>
      </div>

      {/* Aquarismo vem primeiro na aba IA — entrega principal FEBRACE */}
      {renderAquarismo()}

      <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Modelo de qualidade da água (ML)</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">RandomForest · previsão de condição + detecção de anomalias</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Modelo" value={status.model ?? '—'} tone="primary" />
        <StatCard label="Tarefa" value={status.task === 'classification' ? 'Classificação' : status.task === 'regression' ? 'Regressão' : (status.task ?? '—')} tone="neutral" />
        <StatCard label="Variável-alvo" value={status.target ?? '—'} tone="neutral" />
        <StatCard label="Amostras" value={status.n_samples ?? '—'} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Fonte dos dados</h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-slate-500 dark:text-slate-400">Dataset</dt><dd className="font-mono text-xs text-slate-700 dark:text-slate-300">{status.dataset ?? '—'}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500 dark:text-slate-400">Origem</dt><dd className="text-xs text-slate-700 dark:text-slate-300">{status.dataset_origin ?? '—'}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500 dark:text-slate-400">Variáveis (features)</dt><dd className="text-xs text-slate-700 dark:text-slate-300">{(status.features ?? []).map(featureLabel).join(', ')}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500 dark:text-slate-400">Rótulos</dt><dd className="text-xs text-slate-700 dark:text-slate-300">{status.labels ? status.labels.join(', ') : '—'}</dd></div>
          </dl>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Métricas</h3>
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
          ) : (<p className="text-sm text-slate-400 dark:text-slate-500">Métricas não disponíveis.</p>)}
        </div>
      </div>

      {status.overfitting && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Verificação de sobreajuste (overfitting)</h3>
            {status.overfitting.warning && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">ALERTA DE SOBREAJUSTE</span>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Desempenho em treino" value={status.overfitting.train_score.toFixed(3)} tone="neutral" />
            <StatCard label="Desempenho em teste" value={status.overfitting.test_score.toFixed(3)} tone="neutral" />
            <StatCard label="Diferença (treino − teste)" value={status.overfitting.overfit_gap.toFixed(3)} tone={status.overfitting.warning ? 'warning' : 'ok'} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cm && <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Matriz de confusão</h3><ConfusionMatrixView cm={cm} /></div>}
        {status.feature_importance && status.feature_importance.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Importância das variáveis</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureImportance} layout="vertical" margin={{ top: 5, right: 20, bottom: 0, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }} tickLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }} />
                  <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} width={120} axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }} tickLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }} />
                  <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '12px', color: isDark ? '#f1f5f9' : '#0f172a' }} formatter={(value) => [Number(value).toFixed(4), 'Importância']} />
                  <Bar dataKey="importance" fill={isDark ? '#38bdf8' : '#0284c7'} radius={[0, 8, 8, 0]} isAnimationActive animationDuration={700} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/30 dark:text-amber-300">
        <p><strong>Limitação científica:</strong> modelo treinado sobre {(status.dataset ?? 'um dataset').toUpperCase()}{status.dataset_origin?.toLowerCase().includes('mock') && ' (dados sintéticos)'} — previsões estatísticas, não certificam potabilidade.</p>
        {showTrivialAccuracyNote && (
          <p className="mt-2">
            <strong>Nota sobre a acurácia de 100%:</strong> valor artificial do dataset MOCK, que é
            trivialmente separável{classCounts ? ` (distribuição por classe no teste: ${classCounts.join(' × ')})` : ''}.
            {minorityShare !== null && minorityShare < 0.1
              ? ' A classe minoritária é muito rara, então a acurácia não mede desempenho real — use precisão, recall e F1 com cautela.'
              : ' Não interprete como desempenho real — com dados calibrados os valores cairão para faixas plausíveis.'}{' '}
            Nunca apresente este resultado como validação científica.
          </p>
        )}
      </div>
    </div>
  );
}
