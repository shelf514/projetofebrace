import { useCallback, useEffect, useRef, useState } from 'react';

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
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const data = await fetcherRef.current();
      if (ctrl.signal.aborted) return;
      setState({ data, error: null, loading: false });
    } catch (error) {
      if (ctrl.signal.aborted) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'Erro de rede', loading: false }));
    } finally {
      if (abortRef.current === ctrl) inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      inFlightRef.current = false;
      return;
    }
    let mounted = true;
    let failCount = 0;
    let backoffTimer: ReturnType<typeof setTimeout> | undefined;
    const safeRefresh = async () => {
      if (!mounted || inFlightRef.current) return;
      // Pausa quando aba oculta ou offline (economiza rede/bateria)
      if (typeof document !== 'undefined' && document.hidden) return;
      if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) return;
      inFlightRef.current = true;
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
          await new Promise((r) => {
            backoffTimer = setTimeout(r, Math.min(1000 * failCount, 15000));
          });
        }
      } finally {
        inFlightRef.current = false;
      }
    };
    void safeRefresh();
    const timer = setInterval(() => void safeRefresh(), intervalMs);
    const onVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) void safeRefresh();
    };
    const onOnline = () => void safeRefresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', () => abortRef.current?.abort());
    return () => {
      mounted = false;
      clearInterval(timer);
      if (backoffTimer) clearTimeout(backoffTimer);
      abortRef.current?.abort();
      inFlightRef.current = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [intervalMs, enabled]);

  return { ...state, refresh };
}
