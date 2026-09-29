import { useEffect, useRef, useState } from 'react';
import { ESPECIES } from '../data/especies';
import { api } from '../services/api';
import type { ChatMessage, ChatResponse, EvidenceChunk } from '../types';

function sanitize(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`+/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*\-]\s+/gm, '• ');
}

function renderContent(text: string) {
  const clean = sanitize(text);
  const blocks = clean.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length <= 1) {
    return <span className="whitespace-pre-line break-words">{clean}</span>;
  }
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.startsWith('•')) {
          const items = b.split('\n').map((l) => l.replace(/^•\s*/, '').trim()).filter(Boolean);
          return (
            <ul key={i} className="list-disc pl-4 space-y-1">
              {items.map((it, j) => <li key={j} className="break-words">{it}</li>)}
            </ul>
          );
        }
        if (b.startsWith('Diagnóstico')) {
          return <div key={i} className="rounded-lg bg-amber-50 px-2.5 py-2 text-[13px] text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:ring-amber-800/30">{b}</div>;
        }
        return <p key={i} className="leading-relaxed break-words">{b}</p>;
      })}
    </div>
  );
}

const QUICK_REPLIES = [
  'pH ideal para betta?',
  'posso colocar betta com coridora em 60L?',
  'TDS 800 alto para neon?',
  'Como ciclar o aquário?',
  'Ficha para oscar?',
];

export function AquarismoChat({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Olá! Sou o assistente de aquarismo do AquaSense 🐠\n\nPergunte sobre pH, temperatura, TDS, turbidez, GH, volume, compatibilidade, alimentação, ciclagem ou doenças por espécie. Ex.: "pH ideal para betta?" ou "posso colocar betta com coridora em 60L?".\n\nRespostas são estimativas — não substituem veterinário.' }
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
  const [chatState, setChatState] = useState<ChatResponse['state'] | null>(null);
  const [followup, setFollowup] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceChunk[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    } catch { /* armazenamento indisponível */ }
  }, [convId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const send = async (text: string = input) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);
    setFollowup(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const vol = msg.match(/(\d+[.,]?\d*)\s?(l\b|litros?\b)/i);
      const phM = msg.match(/ph\s?(\d+[.,]\d+|\d+)/i);
      const res = await api.chat({
        message: msg,
        especie: especie || null,
        include_sensor_context: useSensor,
        conversation_id: convId || null,
        ...(vol ? { volume_l: Number(vol[1].replace(',', '.')) } : {}),
        ...(phM ? { ph: Number(phM[1].replace(',', '.')) } : {}),
      }, controller.signal);
      if (res.conversation_id && res.conversation_id !== convId) setConvId(res.conversation_id);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, sources: res.sources, model_used: res.model_used }]);
      setLastMeta({ sources: res.sources, model_used: res.model_used });
      setChatState(res.state ?? null);
      setFollowup(res.followup ?? null);
      setEvidence(res.evidence ?? []);
      if (res.especie && !especie) setEspecie(res.especie);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setToast('Cancelado');
        return;
      }
      const err = e instanceof Error ? e.message : 'Erro ao consultar. Tente novamente.';
      const isRate = err.includes('429') || err.toLowerCase().includes('muitas requisi');
      const errMsg = isRate ? '⚠️ Limite 20 msg/min atingido. Aguarde alguns segundos.' : err;
      setMessages((m) => [...m, { role: 'assistant', content: errMsg, isError: true }]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const cancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const retry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      setMessages((m) => m.filter((msg) => msg !== lastUser));
      void send(lastUser.content);
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
    setChatState(null);
    setFollowup(null);
    setEvidence([]);
    setToast('Conversa limpa');
  };

  const copyLast = async () => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last) return;
    const text = sanitize(last.content);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setToast('Copiado!');
        return;
      }
      throw new Error('clipboard indisponível');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        setToast('Copiado!');
      } catch { /* http LAN sem clipboard: ignora */ }
    }
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
        <span className="text-xs text-slate-400 dark:text-slate-500">30 espécies · TTL 30min</span>
      </div>

      {chatState && (chatState.especie || chatState.volume_l || chatState.ph) && (
        <div aria-live="polite" className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold">Contexto:</span>
          {chatState.especie && <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">{chatState.especie}</span>}
          {chatState.volume_l != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{chatState.volume_l}L</span>}
          {chatState.ph != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">pH {chatState.ph}</span>}
          {chatState.temp != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{chatState.temp}°C</span>}
          {chatState.tds != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">TDS {chatState.tds}</span>}
          {chatState.gh != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">GH {chatState.gh}</span>}
          {chatState.turbidity != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{chatState.turbidity} NTU</span>}
        </div>
      )}

      <div ref={listRef} role="log" aria-live="polite" aria-label="Mensagens do chat" className={compact ? 'flex min-h-[200px] flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950' : 'flex max-h-[420px] min-h-[240px] flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950'}>
        {messages.map((m, i) => (
          <div key={`${m.role}-${i}-${m.content.length}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-sky-600 text-white dark:bg-sky-500' : m.isError ? 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800/30' : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'}`}>
              <div>{renderContent(m.content)}</div>
              {m.isError && (
                <button onClick={retry} className="mt-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300">
                  🔁 Tentar novamente
                </button>
              )}
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

      {evidence.length > 0 && (
        <details aria-label="Evidências da base" className="mb-2">
          <summary className="cursor-pointer text-[11px] font-medium text-sky-700 hover:text-sky-800 dark:text-sky-300">
            📖 Ver evidências ({evidence.length})
          </summary>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {evidence.map((ev) => (
              <button
                key={`${ev.especie}-${ev.campo}`}
                type="button"
                title={`${ev.fonte} — clique para ver a ficha de ${ev.especie}`}
                onClick={() => {
                  setEspecie(ev.especie);
                  void send(`ficha para ${ev.especie}?`);
                }}
                className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300"
              >
                {ev.nome.split('(')[0].trim()} · {ev.texto}
              </button>
            ))}
          </div>
        </details>
      )}

      {followup && !loading && (
        <p role="status" className="mt-2 rounded-full border border-dashed border-sky-300 bg-sky-50 px-3 py-1.5 text-xs text-sky-700 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
          💡 {followup}
        </p>
      )}

      {messages.length <= 1 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void send(q)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <label htmlFor="chat-pergunta" className="sr-only">
          Pergunta sobre aquarismo
        </label>
        <textarea
          id="chat-pergunta"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Pergunte: posso colocar betta com coridora em 60L?"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          maxLength={2000}
        />
        {loading ? (
          <button
            type="button"
            onClick={cancel}
            className="rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600"
          >
            Cancelar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => send()}
            disabled={!input.trim()}
            className="rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-sky-700 disabled:opacity-40 dark:bg-sky-500"
          >
            Enviar
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">{input.length}/2000 caracteres</p>
      {toast && (
        <div role="status" className="fixed bottom-4 right-4 rounded-full bg-slate-900 px-4 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-slate-900">
          {toast}
        </div>
      )}
    </div>
  );
}
