import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AquarismoChat } from './AquarismoChat';

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Esc fecha + devolve foco ao FAB; Tab fica preso no dialog (focus-trap simples)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open ]);

  // Foco no input ao abrir via rAF (sem timeout arbitrário)
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const el = panelRef.current?.querySelector<HTMLInputElement>('#chat-pergunta');
      el?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [open ]);

  return (
    <>
      {/* Painel: desktop = popover ancorado; mobile = bottom-sheet quase fullscreen */}
      {open && createPortal(
        <div
          ref={panelRef}
          id="chat-flutuante"
          role="dialog"
          aria-modal="true"
          aria-label="Chat aquarismo"
          className="animate-fade-in-up fixed inset-x-3 bottom-24 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-5 sm:top-auto sm:h-[560px] sm:w-[390px] dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-3 text-white dark:border-slate-700">
            <span aria-hidden="true" className="text-lg">🐠</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight">Chat aquarismo</p>
              <p className="truncate text-[11px] text-sky-100">pH · temp · TDS · GH · volume</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
              aria-label="Fechar chat"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-base transition-colors hover:bg-white/25"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <AquarismoChat compact />
          </div>
        </div>,
        document.body,
      )}

      {/* FAB */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fechar chat aquarismo' : 'Abrir chat aquarismo'}
        aria-expanded={open}
        aria-controls="chat-flutuante"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-2xl text-white shadow-xl shadow-sky-600/30 transition-all hover:bg-sky-700 hover:shadow-2xl active:scale-95 dark:bg-sky-500 dark:hover:bg-sky-400"
      >
        <span aria-hidden="true">{open ? '✕' : '💬'}</span>
      </button>
    </>
  );
}
