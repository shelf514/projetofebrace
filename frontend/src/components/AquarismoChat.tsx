import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { ChatMessage } from '../types';

const ESPECIES = [
  'betta','neon','guppy','molinesia','plati','espada','cascudo','kingui','colisa','matogrosso','coridora','acaradisco','oscar','tetra','paulistinha'
];

const SUGESTOES = [
  'pH ideal para betta?',
  'Meu TDS 800 está alto para neon?',
  'Temperatura ideal para kingui',
  'Trocas parciais: quanto e quando?',
];

export function AquarismoChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Olá! Sou o assistente de aquarismo do AquaSense 🐠\n\nPergunte sobre pH, temperatura, TDS, turbidez ou GH para qualquer espécie. Ex.: "pH ideal para betta?" ou ative "usar leitura atual" e pergunte "está bom para neon?".\n\n*Respostas são estimativas — não substituem veterinário.*' }
  ]);
  const [input, setInput] = useState('');
  const [especie, setEspecie] = useState('');
  const [useSensor, setUseSensor] = useState(true);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string = input) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.chat({
        message: msg,
        especie: especie || null,
        include_sensor_context: useSensor,
      });
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: e instanceof Error ? e.message : 'Erro ao consultar. Tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">💬 Chat aquarismo — pH, temp, TDS por espécie</h3>
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">Offline-first · regras locais</span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={especie}
          onChange={(e) => setEspecie(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="">Espécie (opcional)</option>
          {ESPECIES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <label className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <input type="checkbox" checked={useSensor} onChange={(e) => setUseSensor(e.target.checked)} className="h-3.5 w-3.5 rounded" />
          usar leitura atual
        </label>
        <span className="text-xs text-slate-400 dark:text-slate-500">15 espécies na base</span>
      </div>

      <div ref={listRef} className="flex max-h-[380px] min-h-[220px] flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.role === 'user' ? 'bg-sky-600 text-white dark:bg-sky-500' : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="self-start rounded-2xl bg-white px-3 py-2 text-xs text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400 animate-pulse">Digitando…</div>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGESTOES.map((s) => (
          <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{s}</button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Pergunte: pH ideal para betta com TDS 400?"
          className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          maxLength={2000}
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-sky-700 disabled:opacity-40 dark:bg-sky-500"
        >
          Enviar
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">Limite 2000 caracteres · 20 msg/min · Se configurar OPENAI_API_KEY, respostas ficam mais naturais (senão, regras locais).</p>
    </div>
  );
}
