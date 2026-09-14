import { useEffect, useMemo, useState } from 'react';
import { AnomalyBadge } from '../components/Badges';
import { ErrorState, LoadingState } from '../components/States';
import { api, formatTimestamp } from '../services/api';
import { exportCsv } from '../services/format';
import type { Reading } from '../types';

const PAGE_SIZE = 25;

export function History() {
  const [data, setData] = useState<Reading[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sortDesc, setSortDesc] = useState(true);
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [predictionFilter, setPredictionFilter] = useState('');
  const [deviceId, setDeviceId] = useState('');

  const load = async () => {
    setError(null);
    try {
      const readings = await api.readings({
        device_id: deviceId || undefined,
        anomaly: anomalyOnly ? true : undefined,
        prediction: predictionFilter || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setData(readings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar histórico');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, anomalyOnly, predictionFilter, deviceId]);

  const rows = useMemo(() => {
    const sorted = [...(data ?? [])];
    sorted.sort((a, b) =>
      sortDesc ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    return sorted;
  }, [data, sortDesc]);

  const exportAll = async () => {
    try {
      const all = await api.readings({ device_id: deviceId || undefined, limit: 10000 });
      exportCsv(all);
    } catch {
      exportCsv(rows);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent dark:from-white dark:to-slate-300">Histórico</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Medições registradas · Página {page + 1}</p>
        </div>
        <button
          type="button"
          onClick={exportAll}
          className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-sky-700 hover:shadow-lg active:scale-[0.98] dark:bg-sky-500"
        >
          ⬇ Exportar CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <input
            type="checkbox"
            checked={anomalyOnly}
            onChange={(e) => { setAnomalyOnly(e.target.checked); setPage(0); }}
            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          Apenas anomalias
        </label>
        <input
          value={deviceId}
          onChange={(e) => { setDeviceId(e.target.value); setPage(0); }}
          placeholder="Filtrar por device_id"
          className="flex-1 min-w-[180px] rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
        <input
          value={predictionFilter}
          onChange={(e) => { setPredictionFilter(e.target.value); setPage(0); }}
          placeholder="Filtrar por predição"
          className="flex-1 min-w-[160px] rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? (
        <LoadingState message="Carregando histórico..." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Data/hora</th>
                  <th className="px-4 py-3 font-semibold">Dispositivo</th>
                  <th className="px-4 py-3 text-right font-semibold">Temp (°C)</th>
                  <th className="px-4 py-3 text-right font-semibold">Turbidez</th>
                  <th className="px-4 py-3 text-right font-semibold">TDS</th>
                  <th className="px-4 py-3 font-semibold">Predição</th>
                  <th className="px-4 py-3 text-right font-semibold">Conf.</th>
                  <th className="px-4 py-3 font-semibold">Anomalia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-sky-50/60 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300">{formatTimestamp(r.timestamp)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{r.device_id}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums dark:text-slate-200">{r.temperature.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums dark:text-slate-200">{r.turbidity.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums dark:text-slate-200">{r.tds.toFixed(0)}</td>
                    <td className="px-4 py-2.5">
                      {r.prediction ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">{r.prediction}</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums dark:text-slate-300">{r.prediction_probability != null ? `${(r.prediction_probability * 100).toFixed(0)}%` : '—'}</td>
                    <td className="px-4 py-2.5"><AnomalyBadge anomaly={r.anomaly} /></td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhuma leitura com esses filtros</p>
                      <p className="mt-1 text-xs text-slate-400">Tente limpar device_id ou predição</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">NTU = turbidez · ppm ≈ mg/L (TDS = sólidos dissolvidos)</p>

      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">← Anterior</button>
        <button type="button" onClick={() => setSortDesc((v) => !v)} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900">↕ {sortDesc ? 'Recentes' : 'Antigas'}</button>
        <button type="button" onClick={() => setPage((p) => p + 1)} disabled={!data || data.length < PAGE_SIZE} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">Próxima →</button>
      </div>
    </div>
  );
}
