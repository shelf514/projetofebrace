import { SensorStatusBadge, StatusBadge } from '../components/Badges';
import { ErrorState, LoadingState } from '../components/States';
import { StatCard } from '../components/StatCard';
import { usePolling } from '../hooks/usePolling';
import { api, formatTimestamp } from '../services/api';
import { sensorStatus } from '../services/format';

export function DevicePage() {
  const { data: devices, error, refresh } = usePolling(() => api.devices(), 10000);
  const { data: latest } = usePolling(() => api.latestReading(), 10000);

  const status = sensorStatus(latest ? [latest] : []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Dispositivo</h2>
          <p className="text-sm text-slate-500">Estado do ESP32 e dos sensores</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
        >
          Atualizar
        </button>
      </div>

      {error && !devices ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !devices ? (
        <LoadingState message="Carregando dispositivos..." />
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          Nenhum dispositivo registrado. Envie uma leitura pelo ESP32 ou use o seed demo.
        </div>
      ) : (
        <div className="space-y-4">
          {devices.map((device) => (
            <div key={device.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-mono text-lg font-bold text-slate-800">{device.id}</h3>
                  <p className="text-sm text-slate-500">{device.name}</p>
                </div>
                <StatusBadge status={device.status} />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Última comunicação" value={formatTimestamp(device.last_seen)} tone="neutral" />
                <StatCard
                  label="Status"
                  value={<StatusBadge status={device.status} />}
                  tone={device.status === 'online' ? 'ok' : 'critical'}
                  hint="Online se houver leitura nos últimos 5 minutos"
                />
                <StatCard
                  label="Comunicação"
                  value="Wi-Fi / HTTP"
                  tone="neutral"
                  hint="POST /api/readings com chave de API"
                />
              </div>

              <div className="mt-5">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Status dos sensores</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Temperatura</p>
                      <p className="text-xs text-slate-400">DS18B20 waterproof</p>
                    </div>
                    <SensorStatusBadge status={status.temperature} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Turbidez</p>
                      <p className="text-xs text-slate-400">Sensor de turbidez</p>
                    </div>
                    <SensorStatusBadge status={status.turbidity} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">TDS</p>
                      <p className="text-xs text-slate-400">Sensor TDS</p>
                    </div>
                    <SensorStatusBadge status={status.tds} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  ATENÇÃO indica leitura fora dos limites esperados. As placas eletrônicas e o ESP32 nunca entram em
                  contato com a água — somente as sondas ficam submersas.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
