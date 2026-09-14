import { useEffect, useState } from 'react';
import { getApiBaseUrl, setApiBaseUrl } from '../services/api';

export function ApiSettings() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(getApiBaseUrl());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUrl(getApiBaseUrl());
    setSaved(false);
  }, [open]);

  const save = () => {
    try {
      setApiBaseUrl(url);
      setSaved(true);
      window.dispatchEvent(new StorageEvent('storage', { key: 'aquasense.api_url', newValue: url }));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'URL invalida');
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-sky-100 backdrop-blur transition-all hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98]"
        title="Configurar endereço do backend"
      >
        <span className="text-sm">⚙</span>
        <span className="hidden sm:inline">API</span>
      </button>
      {open && (
        <div className="animate-fade-in absolute right-0 top-full z-50 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Endereço do backend</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            No celular/APK, use o IP do computador na rede local (ex.: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">http://192.168.0.10:8000</code>).
          </p>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://192.168.0.10:8000"
            className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={save}
              className="rounded-xl bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-sky-700 hover:shadow-lg active:scale-[0.98] dark:bg-sky-500 dark:hover:bg-sky-600"
            >
              Salvar
            </button>
            {saved && <span className="animate-fade-in text-xs font-semibold text-emerald-600 dark:text-emerald-400">Salvo ✓</span>}
          </div>
        </div>
      )}
    </div>
  );
}
