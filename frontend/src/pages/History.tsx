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
      sortDesc
        ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Histórico</h2>
          <p className="text-sm text-slate-500">Medições registradas pelo sistema</p>
        </div>
        <button
          type="button"
          onClick={exportAll}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
        >
          ⬇ Exportar CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={anomalyOnly}
            onChange={(e) => {
              setAnomalyOnly(e.target.checked);
              setPage(0);
            }}
            className="h-4 w-4 rounded border-slate-300 text-sky-600"
          />
          Apenas anomalias
        </label>
        <input
          value={deviceId}
          onChange={(e) => {
            setDeviceId(e.target.value);
            setPage(0);
          }}
          placeholder="device_id (ex.: AQUASENSE-001)"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-none"
        />
        <input
          value={predictionFilter}
          onChange={(e) => {
            setPredictionFilter(e.target.value);
            setPage(0);
          }}
          placeholder="predição (ex.: boa)"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-none"
        />
        <span className="ml-auto text-xs text-slate-400">Mostrando página {page + 1}</span>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? (
        <LoadingState message="Carregando histórico..." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-semibold">Data/hora</th>
                <th className="px-4 py-3 font-semibold">Dispositivo</th>
                <th className="px-4 py-3 text-right font-semibold">Temperatura (°C)</th>
                <th className="px-4 py-3 text-right font-semibold">Turbidez (NTU)</th>
                <th className="px-4 py-3 text-right font-semibold">TDS (ppm)</th>
                <th className="px-4 py-3 font-semibold">Predição</th>
                <th className="px-4 py-3 text-right font-semibold">Confiança</th>
                <th className="px-4 py-3 font-semibold">Anomalia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-sky-50/40">
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">{formatTimestamp(r.timestamp)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.device_id}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.temperature.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.turbidity.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.tds.toFixed(0)}</td>
                  <td className="px-4 py-2.5">
                    {r.prediction ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">{r.prediction}</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.prediction_probability != null ? `${(r.prediction_probability * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <AnomalyBadge anomaly={r.anomaly} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Nenhuma leitura encontrada para os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        NTU = unidade de turbidez (partículas suspensas) · ppm ≈ mg/L — TDS = sólidos dissolvidos totais
        (sais e minerais).
      </p>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 disabled:opacity-40 hover:bg-slate-50"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={() => setSortDesc((v) => !v)}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Ordenar: {sortDesc ? 'mais recentes primeiro' : 'mais antigas primeiro'}
        </button>
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          disabled={!data || data.length < PAGE_SIZE}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 disabled:opacity-40 hover:bg-slate-50"
        >
          Próxima →
        </button>
      </div>
    </div>
  );
}
