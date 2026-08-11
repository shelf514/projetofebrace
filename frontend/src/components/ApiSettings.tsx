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
    setApiBaseUrl(url);
    setSaved(true);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-sky-100 hover:bg-white/25"
        title="Configurar endereço do backend"
      >
        ⚙ API: {getApiBaseUrl()}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <h3 className="text-sm font-semibold text-slate-800">Endereço do backend</h3>
          <p className="mt-1 text-xs text-slate-500">
            No celular/APK, use o IP do computador na rede local (ex.: http://192.168.0.10:8000).
          </p>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://192.168.0.10:8000"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
            >
              Salvar
            </button>
            {saved && <span className="text-xs font-semibold text-emerald-600">Salvo ✓</span>}
          </div>
        </div>
      )}
    </div>
  );
}
