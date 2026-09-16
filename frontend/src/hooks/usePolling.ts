import { useEffect, useRef, useState } from 'react';

interface PollingState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled = true,
): PollingState<T> & { refresh: () => Promise<void> } {
  const [state, setState] = useState<PollingState<T>>({ data: null, error: null, loading: true });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = async () => {
    try {
      const data = await fetcherRef.current();
      setState({ data, error: null, loading: false });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'Erro de rede', loading: false }));
    }
  };

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    let failCount = 0;
    const safeRefresh = async () => {
      // Pausa quando aba oculta ou offline (economiza rede/bateria)
      if (typeof document !== 'undefined' && document.hidden) return;
      if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) return;
      try {
        const data = await fetcherRef.current();
        if (!mounted) return;
        failCount = 0;
        setState({ data, error: null, loading: false });
      } catch (error) {
        if (!mounted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        failCount += 1;
        setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'Erro de rede', loading: false }));
        // Backoff simples no erro: pula proximo(s) ciclo(s)
        if (failCount >= 3) {
          await new Promise((r) => setTimeout(r, Math.min(1000 * failCount, 15000)));
        }
      }
    };
    void safeRefresh();
    const timer = setInterval(() => void safeRefresh(), intervalMs);
    const onVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) void safeRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mounted = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, enabled]);

  return { ...state, refresh };
}
