import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { EspecieFicha, EspecieResumo, RecomendarResponse } from '../types';

const ESPECIES = [
  'betta','neon','guppy','molinesia','plati','espada','cascudo','kingui','colisa','matogrosso','coridora','acaradisco','oscar','tetra','paulistinha'
];

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'ok' | 'warning' | 'critical' | 'neutral' }) {
  const cls = {
    ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }[tone];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function AquarismoRecomendador() {
  const [especie, setEspecie] = useState('betta');
  const [volume, setVolume] = useState('');
  const [companheiros, setCompanheiros] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecomendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleComp = (e: string) => {
    setCompanheiros((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  };

  const recomendar = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload: any = { especie };
      if (volume.trim()) payload.volume_l = Number(volume);
      if (companheiros.length) payload.companheiros = companheiros;
      const res = await api.aquarismoRecomendar(payload);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao recomendar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">🐟 Recomendação por espécie — volume, parâmetros e compatibilidade</h3>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Fase 1 · 15 espécies</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Espécie</span>
          <select value={especie} onChange={(e) => setEspecie(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {ESPECIES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Volume do aquário (L)</span>
          <input value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="Ex.: 60" type="number" min={1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
        </label>
      </div>

      <div className="mt-3">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Companheiros (opcional)</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ESPECIES.filter((e) => e !== especie).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => toggleComp(e)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${companheiros.includes(e) ? 'border-sky-500 bg-sky-600 text-white dark:border-sky-400 dark:bg-sky-500' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
            >
              {e}
            </button>
          ))}
        </div>
        {companheiros.length > 0 && <p className="mt-1 text-xs text-slate-400">Selecionados: {companheiros.join(', ')} · <button onClick={() => setCompanheiros([])} className="underline">limpar</button></p>}
      </div>

      <button onClick={recomendar} disabled={loading} className="mt-4 w-full rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-sky-700 disabled:opacity-40 dark:bg-sky-500 sm:w-auto sm:px-8">
        {loading ? 'Consultando…' : 'Recomendar'}
      </button>

      {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

      {result && (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{result.nome}</h4>
            <Badge tone="neutral">{result.ficha.dificuldade}</Badge>
            <Badge>{result.ficha.volume_min_l}L mín</Badge>
            <Badge>{result.ficha.tamanho_adulto_cm} cm adulto</Badge>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
              <div className="font-semibold text-slate-700 dark:text-slate-200">Parâmetros ideais</div>
              <div className="mt-1 text-slate-600 dark:text-slate-400">
                pH {result.ficha.ph_min}-{result.ficha.ph_max} · temp {result.ficha.temp_min}-{result.ficha.temp_max}°C · TDS até {result.ficha.tds_max} ppm · GH {result.ficha.gh_min}-{result.ficha.gh_max}
              </div>
              <div className="mt-1 text-slate-500 dark:text-slate-500">{result.ficha.bioma} · {result.ficha.notas}</div>
            </div>
            <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
              <div className="font-semibold text-slate-700 dark:text-slate-200">Dieta & comportamento</div>
              <div className="mt-1 text-slate-600 dark:text-slate-400">{result.ficha.dieta}</div>
              <div className="mt-1 text-slate-500 dark:text-slate-500">{result.ficha.comportamento}</div>
            </div>
          </div>

          {result.alertas.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/30 dark:bg-amber-950/30">
              <div className="text-xs font-bold text-amber-800 dark:text-amber-300">⚠️ Alertas</div>
              <ul className="mt-1 list-disc pl-4 text-xs text-amber-700 dark:text-amber-400">
                {result.alertas.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {result.recomendacoes.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800/30 dark:bg-emerald-950/20">
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">✅ Recomendações</div>
              <ul className="mt-1 list-disc pl-4 text-xs text-emerald-700 dark:text-emerald-400">
                {result.recomendacoes.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {result.compatibilidade.length > 0 && (
            <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Compatibilidade</div>
              <ul className="mt-1 space-y-1 text-xs">
                {result.compatibilidade.map((c, i) => (
                  <li key={i} className={c.compativel === true ? 'text-emerald-700 dark:text-emerald-300' : c.compativel === false ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}>
                    {c.compativel === true ? '✅' : c.compativel === false ? '❌' : '⚠️'} {c.especies.join(' + ')} — {c.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[11px] text-slate-400 dark:text-slate-500">Fontes: {result.fontes.join(' · ') || result.ficha.fontes.join(' · ')}</div>
        </div>
      )}
    </div>
  );
}

export function CatalogoEspecies() {
  const [data, setData] = useState<EspecieResumo[] | null>(null);
  const [selected, setSelected] = useState<EspecieFicha | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.aquarismoEspecies().then((r) => setData(r.especies)).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const open = async (especie: string) => {
    try {
      const f = await api.aquarismoFicha(especie);
      setSelected(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Carregando espécies…</div>;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">📚 Catálogo — 15 espécies na base</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Clique para ver ficha completa (pH, temp, TDS, GH, volume, dieta, compatíveis).</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {data.map((e) => (
          <button key={e.especie} onClick={() => open(e.especie)} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:bg-white hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{e.nome}</div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">pH {e.ph_min}-{e.ph_max} · {e.temp_min}-{e.temp_max}°C</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">TDS ≤{e.tds_max} · {e.volume_min_l}L · {e.dificuldade}</div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800/30 dark:bg-sky-950/20">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{selected.nome} — {selected.especie}</h4>
            <button onClick={() => setSelected(null)} className="rounded-full bg-white px-3 py-1 text-xs ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">✕</button>
          </div>
          <dl className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
            <div><span className="font-semibold">pH:</span> {selected.ph_min}-{selected.ph_max}</div>
            <div><span className="font-semibold">Temp:</span> {selected.temp_min}-{selected.temp_max}°C</div>
            <div><span className="font-semibold">TDS:</span> {selected.tds_min}-{selected.tds_max} ppm</div>
            <div><span className="font-semibold">GH:</span> {selected.gh_min}-{selected.gh_max}</div>
            <div><span className="font-semibold">Volume mín:</span> {selected.volume_min_l}L</div>
            <div><span className="font-semibold">Tamanho:</span> {selected.tamanho_adulto_cm} cm</div>
            <div className="sm:col-span-2"><span className="font-semibold">Dieta:</span> {selected.dieta}</div>
            <div className="sm:col-span-2"><span className="font-semibold">Comportamento:</span> {selected.comportamento}</div>
            <div className="sm:col-span-2"><span className="font-semibold">Compatíveis:</span> {selected.compativeis.join(', ') || '—'}</div>
            <div className="sm:col-span-2"><span className="font-semibold">Incompatíveis:</span> {selected.incompativeis.join(', ') || '—'}</div>
            <div className="sm:col-span-2"><span className="font-semibold">Nota:</span> {selected.notas}</div>
            <div className="sm:col-span-2 text-[11px] text-slate-500">Fontes: {selected.fontes.join(' · ')}</div>
          </dl>
        </div>
      )}
    </div>
  );
}
