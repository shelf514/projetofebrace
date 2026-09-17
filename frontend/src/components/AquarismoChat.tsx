import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { ChatMessage } from '../types';

const ESPECIES = [
  'betta','neon','guppy','molinesia','plati','espada','cascudo','kingui','colisa','matogrosso','coridora','acaradisco','oscar','tetra','paulistinha'
];

const SUGESTOES = [
  'pH ideal para betta?',
  'TDS 800 está alto para neon?',
  'posso colocar betta com coridora em 60L?',
  'volume mínimo para oscar?',
  'dieta do acaradisco',
  'GH ideal para guppy?',
];

function sanitize(text: string): string {
  // Remove markdown residual e normaliza bullets (backend já sanitiza, mas garante no frontend)
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`+/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[\*\-]\s+/gm, '• ');
}

function renderContent(text: string) {
  const clean = sanitize(text);
  // Separa por linha dupla = parágrafos distintos
  const blocks = clean.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length <= 1) {
    // Renderiza quebras simples como linhas
    return <span className="whitespace-pre-line">{clean}</span>;
  }
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        // Bloco que começa com • = lista
        if (b.startsWith('•')) {
          const items = b.split('\n').map((l) => l.replace(/^•\s*/, '').trim()).filter(Boolean);
          return (
            <ul key={i} className="list-disc pl-4 space-y-1">
              {items.map((it, j) => <li key={j}>{it}</li>)}
            </ul>
          );
        }
        // Diagnóstico = destaca
        if (b.startsWith('Diagnóstico')) {
          return <div key={i} className="rounded-lg bg-amber-50 px-2.5 py-2 text-[13px] text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:ring-amber-800/30">{b}</div>;
        }
        return <p key={i} className="leading-relaxed">{b}</p>;
      })}
    </div>
  );
}

export function AquarismoChat({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Olá! Sou o assistente de aquarismo do AquaSense 🐠\n\nPergunte sobre pH, temperatura, TDS, turbidez, GH, volume ou compatibilidade por espécie. Ex.: "pH ideal para betta?" ou "posso colocar betta com coridora em 60L?". Ative "usar leitura atual" para diagnóstico automático.\n\nRespostas são estimativas — não substituem veterinário.' }
  ]);
  const [input, setInput] = useState('');
  const [especie, setEspecie] = useState('');
  const [useSensor, setUseSensor] = useState(true);
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState<string>(() => {
    try {
      return localStorage.getItem('aquasense.conv_id') || '';
    } catch {
      return '';
    }
  });
  const [lastMeta, setLastMeta] = useState<{ sources: string[]; model_used: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    try {
      if (convId) localStorage.setItem('aquasense.conv_id', convId);
    } catch { /* armazenamento indisponível (ex.: teste/APK restrito) */ }
  }, [convId]);

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
        conversation_id: convId || null,
      });
      if (res.conversation_id && res.conversation_id !== convId) setConvId(res.conversation_id);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, sources: res.sources, model_used: res.model_used }]);
      setLastMeta({ sources: res.sources, model_used: res.model_used });
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Erro ao consultar. Tente novamente.';
      const isRate = err.includes('429') || err.toLowerCase().includes('muitas requisi');
      setMessages((m) => [...m, { role: 'assistant', content: isRate ? '⚠️ Limite 20 msg/min atingido. Aguarde alguns segundos.' : err }]);
    } finally {
      setLoading(false);
    }
  };

  const clear = async () => {
    if (convId) {
      try { await api.chatHistoryDelete(convId); } catch { /* ignore */ }
    }
    setConvId('');
    try { localStorage.removeItem('aquasense.conv_id'); } catch { /* ignore */ }
    setMessages([{ role: 'assistant', content: 'Conversa limpa. Como posso ajudar com seu aquário? 🐠' }]);
    setLastMeta(null);
  };

  const copyLast = async () => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (last) await navigator.clipboard.writeText(sanitize(last.content));
  };

  return (
    <div className={compact ? 'flex min-h-0 flex-1 flex-col' : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'}>
      {!compact && (
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">💬 Chat aquarismo — pH, temp, TDS, GH, volume e compatibilidade</h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">Offline-first · regras locais</span>
          {lastMeta && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${lastMeta.model_used === 'openai' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{lastMeta.model_used}</span>}
        </div>
      </div>
      )}
      {compact && lastMeta && (
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">Offline-first</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${lastMeta.model_used === 'openai' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{lastMeta.model_used}</span>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label htmlFor="chat-especie" className="sr-only">
          Espécie
        </label>
        <select
          id="chat-especie"
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
        <button onClick={clear} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">🗑 Limpar</button>
        <button onClick={copyLast} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">⎘ Copiar</button>
        <span className="text-xs text-slate-400 dark:text-slate-500">15 espécies · TTL 30min</span>
      </div>

      <div ref={listRef} role="log" aria-live="polite" aria-label="Mensagens do chat" className={compact ? 'flex min-h-[200px] flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950' : 'flex max-h-[420px] min-h-[240px] flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950'}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-sky-600 text-white dark:bg-sky-500' : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'}`}>
              <div>{renderContent(m.content)}</div>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 border-t border-slate-200 pt-1.5 text-[11px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  Fontes: {m.sources.join(' · ')} {m.model_used && `· ${m.model_used}`}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div role="status" className="self-start rounded-2xl bg-white px-3 py-2 text-xs text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400 animate-pulse">Digitando…</div>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGESTOES.map((s) => (
          <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{s}</button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <label htmlFor="chat-pergunta" className="sr-only">
          Pergunta sobre aquarismo
        </label>
        <input
          id="chat-pergunta"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Pergunte: posso colocar betta com coridora em 60L?"
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
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">Limite 2000 caracteres · 20 msg/min · Se configurar OPENAI_API_KEY, respostas ficam mais naturais (senão, regras locais). Conversa persiste 30 min.</p>
    </div>
  );
}
