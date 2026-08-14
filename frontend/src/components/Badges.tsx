export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  let className = 'bg-slate-100 text-slate-600';
  let dot = 'bg-slate-400';
  if (normalized === 'online') {
    className = 'bg-emerald-100 text-emerald-700';
    dot = 'bg-emerald-500';
  } else if (normalized === 'offline') {
    className = 'bg-red-100 text-red-700';
    dot = 'bg-red-500';
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {normalized === 'online' ? 'ONLINE' : normalized === 'offline' ? 'OFFLINE' : 'DESCONHECIDO'}
    </span>
  );
}

export function AnomalyBadge({ anomaly }: { anomaly: boolean | null }) {
  if (anomaly === null || anomaly === undefined) {
    return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">SEM INFO</span>;
  }
  return anomaly ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
      <span className="h-2 w-2 rounded-full bg-red-500" />
      ANOMALIA
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      NORMAL
    </span>
  );
}

export function SensorStatusBadge({ status }: { status: 'ok' | 'attention' | 'sem_dados' }) {
  if (status === 'ok') return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">OK</span>;
  if (status === 'attention')
    return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">ATENÇÃO</span>;
  return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">SEM DADOS</span>;
}
