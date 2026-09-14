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
    const safeRefresh = async () => {
      try {
        const data = await fetcherRef.current();
        if (!mounted) return;
        setState({ data, error: null, loading: false });
      } catch (error) {
        if (!mounted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'Erro de rede', loading: false }));
      }
    };
    void safeRefresh();
    const timer = setInterval(() => void safeRefresh(), intervalMs);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, enabled]);

  return { ...state, refresh };
}
