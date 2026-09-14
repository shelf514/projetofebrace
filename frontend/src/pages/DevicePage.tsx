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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent dark:from-white dark:to-slate-300">Dispositivo</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Estado do ESP32 e dos sensores</p>
        </div>
        <button type="button" onClick={refresh} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-900">↻ Atualizar</button>
      </div>

      {error && !devices ? <ErrorState message={error} onRetry={refresh} /> : !devices ? <LoadingState message="Carregando dispositivos..." /> : devices.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">Nenhum dispositivo registrado. Ligue o ESP32 ou aguarde o simulador.</div>
      ) : (
        <div className="animate-stagger space-y-4">
          {devices.map((device) => (
            <div key={device.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-mono text-lg font-bold text-slate-800 dark:text-slate-100">{device.id}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{device.name}</p>
                </div>
                <StatusBadge status={device.status} />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Última comunicação" value={formatTimestamp(device.last_seen)} />
                <StatCard label="Status" value={<StatusBadge status={device.status} />} tone={device.status === 'online' ? 'ok' : 'critical'} hint="Online se leitura < 5 min" />
                <StatCard label="Comunicação" value="Wi-Fi / HTTP" hint="POST /api/readings + X-API-Key" />
              </div>
              <div className="mt-5">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sensores</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(['temperature','turbidity','tds'] as const).map(k => (
                    <div key={k} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                      <div><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{k==='temperature'?'Temperatura':k==='turbidity'?'Turbidez':'TDS'}</p><p className="text-xs text-slate-400">{k==='temperature'?'DS18B20':k==='turbidity'?'Óptico':'Condutividade'}</p></div>
                      <SensorStatusBadge status={status[k]} />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Placas e ESP32 não entram na água — só sondas.</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
