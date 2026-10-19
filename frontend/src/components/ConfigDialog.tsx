import { useState } from 'react';
import { getApiBaseUrl, isValidApiUrl, setApiBaseUrl } from '../services/api';

export function ConfigDialog({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState(getApiBaseUrl());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = () => {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (trimmed && !isValidApiUrl(trimmed)) {
      setError('URL deve começar com http:// ou https://');
      return;
    }
    try {
      setApiBaseUrl(trimmed);
      setError(null);
      setSaved(true);
      setTimeout(onClose, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configurar endereço do backend"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Configurar backend</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Emulador: <code className="font-mono">http://10.0.2.2:8000</code> · Device físico: <code className="font-mono">http://192.168.0.10:8000</code>
        </p>
        <label htmlFor="api-url" className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-300">
          URL da API
        </label>
        <input
          id="api-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://192.168.0.10:8000"
          inputMode="url"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
        {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {saved && <p role="status" className="mt-2 text-xs text-emerald-600">Salvo! Reconectando…</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:text-slate-300 dark:ring-slate-700">
            Fechar
          </button>
          <button type="button" onClick={save} className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white dark:bg-sky-500">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
