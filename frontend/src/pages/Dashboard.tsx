import { useMemo, useState } from 'react';
import { ApiSettings } from '../components/ApiSettings';
import { AnomalyBadge, StatusBadge } from '../components/Badges';
import { ErrorState, LoadingState } from '../components/States';
import { PeriodFilter } from '../components/PeriodFilter';
import { SensorChart } from '../components/SensorChart';
import { StatCard } from '../components/StatCard';
import { usePolling } from '../hooks/usePolling';
import { useWebSocket } from '../hooks/useWebSocket';
import { api, formatTimestamp } from '../services/api';
import { periodRange } from '../services/format';
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

  const { data: health, error: healthError, refresh: refreshHealth } = usePolling(() => api.health(), 10000);
  const { data: polledLatest, error: latestError, refresh: refreshLatest } = usePolling(() => api.latestReading(), 10000);
  const { data: devices, error: devicesError, refresh: refreshDevices } = usePolling(() => api.devices(), 30000);
  const { data: mlStatus } = usePolling(() => api.mlStatus(), 30000);

  const { lastMessage, connected: wsConnected } = useWebSocket<WsReadingMessage>('/ws/readings');
  const latest = wsConnected && lastMessage?.type === 'reading' ? lastMessage.data : polledLatest;

  const { start, end } = useMemo(
    () => periodRange(period, customStart ? new Date(customStart) : undefined, customEnd ? new Date(customEnd) : undefined),
    [period, customStart, customEnd],
  );
  const { data: history, error: historyError, refresh: refreshHistory } = usePolling(
    () => api.history({ start: start.toISOString(), end: end.toISOString(), limit: 5000 }),
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
          label: item.feature,
          value,
          score: item.importance * deviation,
          direction: deviation > 0.05 ? 'elevou' : deviation < -0.05 ? 'reduziu' : 'neutro',
        } as Factor;
      })
      .filter((f): f is Factor => f !== null);
    const total = raw.reduce((sum, f) => sum + Math.abs(f.score), 0);
    return total === 0
      ? []
      : raw.map((f) => ({ ...f, score: (f.score / total) * 100 })).sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  }, [latest, mlStatus]);

  const isDemoDevice = latest?.device_id === 'AQUASENSE-DEMO' || latest?.device_id === 'AQUASENSE-SIM';
  const isDemoModel = /mock|demo|simulado/i.test(mlStatus?.dataset_origin ?? '');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">Dashboard</h2>
            {isDemoDevice && (
              <span
                className="rounded-full border border-sky-300 bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700"
                title="Leituras de exemplo geradas por script — o hardware ESP32 não está conectado"
              >
                DEMO — dados simulados
              </span>
            )}
            {isDemoModel && (
              <span
                className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700"
                title="O modelo foi treinado com dataset sintético (MOCK) — resultados apenas para demonstração"
              >
                Modelo DEMO (dataset MOCK)
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">Monitoramento em tempo real da qualidade da água</p>
        </div>
        <div className="flex items-center gap-2">
          <ApiSettings />
          <button
            type="button"
            onClick={refreshAll}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
          >
            Atualizar agora
          </button>
        </div>
      </div>

      {error && !latest && <ErrorState message={error} onRetry={refreshAll} />}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status do dispositivo:</span>
          <StatusBadge status={device?.status ?? 'desconhecido'} />
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            wsConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
          title={wsConnected ? 'Recebendo leituras em tempo real (WebSocket)' : 'Sem tempo real: atualização por polling a cada 10 s'}
        >
          <span className={`h-2 w-2 rounded-full ${wsConnected ? 'animate-pulse bg-emerald-500' : 'bg-amber-500'}`} />
          {wsConnected ? 'AO VIVO' : 'POLLING (10s)'}
        </span>
        <div className="text-xs text-slate-500">
          Última leitura:{' '}
          <span className="font-semibold text-slate-700">
            {latest ? formatTimestamp(latest.timestamp) : '—'}
          </span>
          {latest && (
            <span className="ml-2 inline-flex items-center gap-1 text-slate-400">
              <span className={`h-2 w-2 rounded-full ${health?.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              API: {health?.status === 'ok' ? 'conectada' : 'instável'}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Temperatura"
          value={latest ? latest.temperature.toFixed(1) : '—'}
          unit="°C"
          tone={latest && latest.temperature > 35 ? 'warning' : 'primary'}
          info="Medida pelo sensor DS18B20 waterproof. Influencia reações químicas e a leitura do TDS. Águas naturais costumam ficar entre 15 e 30 °C."
        />
        <StatCard
          label="Turbidez"
          value={latest ? latest.turbidity.toFixed(1) : '—'}
          unit="NTU"
          tone={latest && latest.turbidity > 100 ? 'warning' : 'neutral'}
          info="Indica partículas suspensas na água (areia, argila, microrganismos). Sensor óptico: quanto menos luz atravessa, maior a turbidez. Padrão brasileiro para água tratada: até 5 NTU."
        />
        <StatCard
          label="TDS"
          value={latest ? latest.tds.toFixed(0) : '—'}
          unit="ppm"
          tone={latest && latest.tds > 500 ? 'warning' : 'neutral'}
          info="Sólidos dissolvidos totais: sais e minerais dissolvidos. Medido por condutividade elétrica. Padrão brasileiro: até 1000 mg/L (1 ppm ≈ 1 mg/L)."
        />
        <StatCard
          label="Modelo"
          value={latest?.prediction ? latest.prediction : 'Sem modelo'}
          tone={latest?.prediction ? 'ok' : 'neutral'}
          hint={latest?.prediction_probability != null ? `Confiança: ${(latest.prediction_probability * 100).toFixed(0)}%` : 'Não treinado'}
          info="O modelo de ML prevê a variável-alvo do dataset de treinamento (ex.: status da água). É uma estimativa estatística, não uma análise de laboratório."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Anomalia"
          value={<AnomalyBadge anomaly={latest ? latest.anomaly : null} />}
          tone={latest?.anomaly ? 'critical' : 'neutral'}
          hint="Detecção por Isolation Forest + limites físicos"
          info="Valores fora do esperado para aquele histórico de medições. Não é erro de medida necessariamente — pode indicar um evento real (contaminação, mudança brusca)."
        />
        <StatCard
          label="Leituras no período"
          value={history ? history.length : '—'}
          tone="neutral"
          hint={`${start.toLocaleDateString('pt-BR')} – ${end.toLocaleDateString('pt-BR')}`}
        />
        <StatCard
          label="Saúde da API"
          value={health?.status === 'ok' ? 'OK' : 'INDISPONÍVEL'}
          tone={health?.status === 'ok' ? 'ok' : 'critical'}
          hint={health?.model_loaded ? `Modelo v${health.model_version ?? '?'} carregado` : 'Modelo não treinado'}
        />
      </div>

      {latest && factors.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700">Por que essa previsão?</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Contribuição estimada de cada fator para a última previsão (importância do modelo × desvio do valor em relação ao típico).
          </p>
          <div className="mt-3 space-y-2">
            {factors.map((factor) => (
              <div key={factor.label} className="flex items-center gap-3">
                <span className="w-24 text-xs font-semibold text-slate-600">{factor.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${factor.direction === 'neutro' ? 'bg-slate-300' : factor.direction === 'elevou' ? 'bg-amber-500' : 'bg-sky-500'}`}
                    style={{ width: `${Math.min(100, Math.abs(factor.score))}%` }}
                  />
                </div>
                <span className={`w-28 text-right text-xs ${factor.direction === 'neutro' ? 'text-slate-400' : factor.direction === 'elevou' ? 'text-amber-700' : 'text-sky-700'}`}>
                  {factor.direction === 'neutro' ? 'neutro' : factor.direction} ({factor.score > 0 ? '+' : ''}{factor.score.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Gráficos</h3>
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
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <SensorChart data={series.temperature} color="#0284c7" unit="°C" label="Temperatura × tempo" />
            <SensorChart
              data={series.turbidity}
              color="#d97706"
              unit="NTU"
              label="Turbidez × tempo"
              reference={{ value: 5, label: 'Padrão: 5 NTU' }}
            />
            <SensorChart
              data={series.tds}
              color="#059669"
              unit="ppm"
              label="TDS × tempo"
              reference={{ value: 1000, label: 'Padrão: 1000 mg/L' }}
            />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        <strong>Importante:</strong> os valores previstos pelo modelo são resultados estatísticos e não substituem
        análises laboratoriais nem certificam a potabilidade da água.
      </div>
    </div>
  );
}
