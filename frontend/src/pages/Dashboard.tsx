import { useMemo, useState } from 'react';
import { AnomalyBadge, StatusBadge } from '../components/Badges';
import { ErrorState, LoadingState } from '../components/States';
import { PeriodFilter } from '../components/PeriodFilter';
import { SensorChart } from '../components/SensorChart';
import { StatCard } from '../components/StatCard';
import { usePolling } from '../hooks/usePolling';
import { useWebSocket } from '../hooks/useWebSocket';
import { api, formatTimestamp } from '../services/api';
import { featureLabel, periodRange } from '../services/format';
import type { Period, WsReadingMessage } from '../types';

interface Factor {
  label: string;
  value: number;
  score: number;
  direction: 'elevou' | 'reduziu' | 'neutro';
}

const PHYSICAL_RANGES: Record<string, { ideal: number; halfRange: number }> = {
  temperature: { ideal: 25, halfRange: 20 },
  turbidity: { ideal: 0, halfRange: 50 },
  tds: { ideal: 200, halfRange: 900 },
};

export function Dashboard() {
  const [period, setPeriod] = useState<Period>('24h');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { lastMessage, connected: wsConnected } = useWebSocket<WsReadingMessage>('/ws/readings');

  const { data: health, error: healthError, refresh: refreshHealth } = usePolling(() => api.health(), 10000);
  // Nao faz poll do latest com WS vivo (economiza 1 req/10s); volta ao polling se WS cair
  const { data: polledLatest, error: latestError, refresh: refreshLatest } = usePolling(
    () => api.latestReading(),
    10000,
    !wsConnected,
  );
  const { data: devices, error: devicesError, refresh: refreshDevices } = usePolling(() => api.devices(), 30000);
  const { data: mlStatus } = usePolling(() => api.mlStatus(), 30000);

  const latest = wsConnected && lastMessage?.type === 'reading' ? lastMessage.data : polledLatest;

  const { start, end } = useMemo(() => {
    const s = customStart ? new Date(customStart) : undefined;
    const e = customEnd ? new Date(customEnd) : undefined;
    if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime()) && s > e) return periodRange('24h');
    if (s && isNaN(s.getTime())) return periodRange(period, undefined, e);
    if (e && isNaN(e.getTime())) return periodRange(period, s, undefined);
    return periodRange(period, s, e);
  }, [period, customStart, customEnd]);

  const { data: history, error: historyError, refresh: refreshHistory } = usePolling(
    () => api.history({ start: start.toISOString(), end: end.toISOString(), limit: 2000 }),
    15000,
  );

  const error = healthError ?? latestError ?? historyError ?? devicesError;

  const series = useMemo(() => {
    const rows = [...(history ?? [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return {
      temperature: rows.map((r) => ({ timestamp: r.timestamp, value: r.temperature })),
      turbidity: rows.map((r) => ({ timestamp: r.timestamp, value: r.turbidity })),
      tds: rows.map((r) => ({ timestamp: r.timestamp, value: r.tds })),
    };
  }, [history]);

  const refreshAll = () => {
    void refreshHealth();
    void refreshLatest();
    void refreshHistory();
    void refreshDevices();
  };

  const device = devices?.[0];

  const factors = useMemo<Factor[]>(() => {
    if (!latest || !mlStatus?.feature_importance?.length) return [];
    const raw = mlStatus.feature_importance
      .map((item) => {
        const value = latest[item.feature as keyof typeof latest];
        const range = PHYSICAL_RANGES[item.feature];
        if (typeof value !== 'number' || !range) return null;
        const deviation = Math.max(-1, Math.min(1, (value - range.ideal) / range.halfRange));
        return {
          label: featureLabel(item.feature),
          value,
          score: item.importance * deviation,
          direction: deviation > 0.05 ? 'elevou' : deviation < -0.05 ? 'reduziu' : 'neutro',
        } as Factor;
      })
      .filter((f): f is Factor => f !== null);
    const total = raw.reduce((sum, f) => sum + Math.abs(f.score), 0);
    return total === 0 ? [] : raw.map((f) => ({ ...f, score: (f.score / total) * 100 })).sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  }, [latest, mlStatus]);

  const isDemoDevice = latest?.device_id === 'AQUASENSE-DEMO' || latest?.device_id === 'AQUASENSE-SIM';
  const isDemoModel = /mock|demo|simulado/i.test(mlStatus?.dataset_origin ?? '');

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent dark:from-white dark:to-slate-300">
                Dashboard
              </h2>
              {isDemoDevice && (
                <span className="animate-fade-in rounded-full border border-sky-300 bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                  DEMO — dados simulados
                </span>
              )}
              {isDemoModel && (
                <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Modelo DEMO
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Visão em tempo real · Sensores a cada 60s · IA no backend</p>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all hover:bg-slate-800 hover:shadow-xl active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <span className="transition-transform group-hover:rotate-180 duration-500">↻</span> Atualizar
          </button>
        </div>
      </div>

      {error && !latest && <ErrorState message={error} onRetry={refreshAll} />}

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dispositivo</span>
          <StatusBadge status={device?.status ?? 'desconhecido'} />
          <span className="hidden text-xs text-slate-300 dark:text-slate-600">·</span>
          <span className="hidden text-xs font-medium text-slate-500 dark:text-slate-400 sm:inline">{device?.id ?? '—'}</span>
        </div>
        <span
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
            wsConnected
              ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${wsConnected ? 'animate-pulse bg-emerald-500 shadow shadow-emerald-500/30' : 'bg-amber-500'}`} />
          {wsConnected ? 'AO VIVO' : 'POLLING 10s'}
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="hidden sm:inline">Última leitura</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {latest ? formatTimestamp(latest.timestamp) : '—'}
          </span>
          <span className={`h-2 w-2 rounded-full ${health?.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        </div>
      </div>

      {/* Métricas principais */}
      <div className="animate-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Temperatura"
          value={latest ? latest.temperature.toFixed(1) : '—'}
          unit="°C"
          tone={latest && latest.temperature > 35 ? 'warning' : 'primary'}
          info="DS18B20 waterproof. Águas naturais: 15–30 °C."
        />
        <StatCard
          label="Turbidez"
          value={latest ? latest.turbidity.toFixed(1) : '—'}
          unit="NTU"
          tone={latest && latest.turbidity > 100 ? 'warning' : 'neutral'}
          sub="Partículas em suspensão"
          info="Óptico: até 5 NTU para água tratada."
        />
        <StatCard
          label="TDS"
          value={latest ? latest.tds.toFixed(0) : '—'}
          unit="ppm"
          tone={latest && latest.tds > 500 ? 'warning' : 'neutral'}
          sub="Sólidos dissolvidos (mg/L)"
        />
        <StatCard
          label="Modelo"
          value={latest?.prediction ? latest.prediction : 'Sem modelo'}
          tone={latest?.prediction ? 'ok' : 'neutral'}
          hint={latest?.prediction_probability != null ? `${(latest.prediction_probability * 100).toFixed(0)}% confiança` : 'Não treinado'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Anomalia"
          value={<AnomalyBadge anomaly={latest ? latest.anomaly : null} />}
          tone={latest?.anomaly ? 'critical' : 'neutral'}
          hint="Isolation Forest + limites físicos"
        />
        <StatCard label="Leituras no período" value={history ? history.length : '—'} hint={`${start.toLocaleDateString('pt-BR')} – ${end.toLocaleDateString('pt-BR')}`} />
        <StatCard
          label="Saúde da API"
          value={health?.status === 'ok' ? 'OK' : 'INDISPONÍVEL'}
          tone={health?.status === 'ok' ? 'ok' : 'critical'}
          hint={health?.model_loaded ? `Modelo v${health.model_version ?? '?'} · ${health.uptime_seconds ? `${Math.floor(health.uptime_seconds / 3600)}h` : ''}` : 'Modelo não treinado'}
        />
      </div>

      {latest && factors.length > 0 && (
        <div className="animate-fade-in rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Por que essa previsão?</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Importância × desvio do típico</p>
          <div className="mt-4 space-y-3">
            {factors.map((factor) => (
              <div key={factor.label} className="flex items-center gap-3">
                <span className="w-28 text-xs font-semibold text-slate-600 dark:text-slate-300">{factor.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${factor.direction === 'neutro' ? 'bg-slate-400 dark:bg-slate-500' : factor.direction === 'elevou' ? 'bg-amber-500' : 'bg-sky-500'}`}
                    style={{ width: `${Math.min(100, Math.abs(factor.score))}%` }}
                  />
                </div>
                <span className={`w-28 text-right text-xs font-medium ${factor.direction === 'neutro' ? 'text-slate-400' : factor.direction === 'elevou' ? 'text-amber-700 dark:text-amber-300' : 'text-sky-700 dark:text-sky-300'}`}>
                  {factor.direction} {factor.score > 0 ? '+' : ''}
                  {factor.score.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Evolução temporal</h3>
          <PeriodFilter
            period={period}
            onPeriodChange={setPeriod}
            customStart={customStart}
            customEnd={customEnd}
            onCustomChange={(s, e) => {
              setCustomStart(s);
              setCustomEnd(e);
            }}
          />
        </div>
        {historyError && !history ? (
          <ErrorState message={historyError} onRetry={refreshHistory} />
        ) : !history ? (
          <LoadingState message="Carregando histórico..." />
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Sem dados no período</p>
            <p className="mt-1 text-xs text-slate-400">Ajuste o filtro ou aguarde o ESP32 enviar leituras.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <SensorChart data={series.temperature} color="#0ea5e9" unit="°C" label="Temperatura" />
            <SensorChart data={series.turbidity} color="#f59e0b" unit="NTU" label="Turbidez" reference={{ value: 5, label: '5 NTU' }} />
            <SensorChart data={series.tds} color="#10b981" unit="ppm" label="TDS" reference={{ value: 1000, label: '1000 mg/L' }} />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-xs leading-relaxed text-amber-800 dark:border-amber-800/30 dark:from-amber-950/30 dark:to-orange-950/20 dark:text-amber-300">
        <strong>Aviso científico:</strong> previsões são estatísticas, não certificam potabilidade. Use análises laboratoriais para decisões sanitárias.
      </div>
    </div>
  );
}
